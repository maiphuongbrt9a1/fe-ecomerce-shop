"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  ChevronLeft,
  MessageSquare,
  Send,
  Wifi,
  WifiOff,
  Loader2,
  Users,
  Clock,
  Package,
  X,
} from "lucide-react";
import { parseProductCard, serializeProductCard, type ProductAttachment } from "@/utils/chat-product";
import ProductMessageCard from "@/components/chat/ProductMessageCard";
import ProductPicker from "@/components/chat/ProductPicker";
import ProductForm from "@/app/admin/products/_components/ProductForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChatSocket, ChatMessage } from "@/hooks/useChatSocket";
import { chatService } from "@/services/chat";
import { ChatMessageDto, ChatRoomDto } from "@/dto/chat";
import { userService, getAvatarUrl } from "@/services/user";

// Extract the other participant's email from a private room name.
// Room name is `emailA-emailB` (lexicographic). Strip the current user's email.
function getPeerLabel(roomName: string, myEmail: string): string {
  const withoutMine = roomName.replace(myEmail, "").replace(/^-|-$/, "");
  return withoutMine || roomName;
}

// Get peer userId from a private room's members list (backward compat)
function getPeerUserId(room: ChatRoomDto, myUserId: number): string | null {
  const other = room.members?.find((m) => m.userId !== myUserId);
  return other ? String(other.userId) : null;
}

// Derive a human-readable label for a support room.
// Uses room description (set by customer at creation) with fallback to ID.
function getSupportRoomLabel(room: ChatRoomDto): string {
  if (room.description) return room.description;
  const match = room.name.match(/^support-(\d+)$/);
  return match ? `Khách hàng #${match[1]}` : room.name;
}


function relativeTime(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

function previewText(text: string): string {
  if (text.startsWith("[[PC:")) return "[Sản phẩm]";
  return text.length > 42 ? text.slice(0, 42) + "…" : text;
}

type SenderKind = "mine" | "customer" | "colleague";

interface LastMessage { text: string; timestamp: Date; isMine: boolean }

interface SenderProfile {
  name: string;
  avatarUrl?: string;
  email?: string;
}

export default function AdminChatPage() {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token ?? null;
  const currentUserEmail = session?.user?.email ?? null;
  const myUserId = session?.user?.id ? Number(session.user.id) : null;
  const searchParams = useSearchParams();
  const initialRoom = searchParams.get("room");

  const [joinedRooms, setJoinedRooms] = useState<ChatRoomDto[]>([]);
  const [queueRooms, setQueueRooms] = useState<ChatRoomDto[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<ChatRoomDto | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [pendingProduct, setPendingProduct] = useState<ProductAttachment | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productDetailId, setProductDetailId] = useState<number | null>(null);
  const [senderProfiles, setSenderProfiles] = useState<Record<string, SenderProfile>>({});
  const [myProfile, setMyProfile] = useState<SenderProfile | null>(null);
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRoomRef = useRef<ChatRoomDto | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const lastMsgIdRef = useRef<string | null>(null);

  const handleIncoming = useCallback((msg: ChatMessage) => {
    if (msg.isMine) return;

    const isForActiveRoom = msg.roomName
      ? msg.roomName === activeRoomRef.current?.name
      : Boolean(activeRoomRef.current?.isPrivate);

    if (isForActiveRoom) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }

    // Update last message preview for the room
    if (msg.roomName) {
      setLastMessages((prev) => ({
        ...prev,
        [msg.roomName!]: { text: msg.text, timestamp: msg.timestamp, isMine: false },
      }));
    }

    // Unread count for non-active rooms
    if (msg.roomName && activeRoomRef.current?.name !== msg.roomName) {
      setUnreadCounts((prev) => ({
        ...prev,
        [msg.roomName!]: (prev[msg.roomName!] ?? 0) + 1,
      }));
    }
  }, []);

  const { connected, sendPrivateMessage, sendRoomMessage, joinRoom } =
    useChatSocket({
      accessToken,
      currentUserEmail,
      onMessage: handleIncoming,
    });

  // Sync ref so handleIncoming can read activeRoom without a stale closure
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // Rejoin all rooms on WS (re)connect — socket doesn't persist room membership across connections
  useEffect(() => {
    if (!connected) return;
    joinedRooms.forEach((r) => joinRoom(r.name));
  // joinRoom is stable (useCallback with no deps); joinedRooms triggers re-run on load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Scroll to bottom only when the LAST message changes (new message appended).
  // Prepending old messages doesn't change the last message id, so no snap-back.
  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (lastId && lastId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = lastId;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load rooms (joined + queue) — runs on mount and every 30s
  const loadRooms = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [joinedRes, adminRes] = await Promise.all([
        chatService.getAllRooms(accessToken),
        chatService.getAdminRooms(accessToken).catch(() => null),
      ]);

      const joined = (joinedRes?.data ?? []) as ChatRoomDto[];
      const joinedIds = new Set(joined.map((r) => r.id));

      const allSupportRooms = (adminRes?.data ?? []) as ChatRoomDto[];
      const queue = allSupportRooms.filter((r) => !joinedIds.has(r.id));

      setJoinedRooms(joined);
      setQueueRooms(queue);

      // Seed last message previews for all rooms in parallel
      const allRooms = [...joined, ...allSupportRooms];
      await Promise.allSettled(
        allRooms.map(async (r) => {
          const res = await chatService.getRoomMessages(r.name, accessToken, 1, 1);
          const msg = (res?.data as ChatMessageDto[])?.[0];
          if (!msg) return;
          setLastMessages((prev) => ({
            ...prev,
            [r.name]: {
              text: msg.content,
              timestamp: new Date(msg.createdAt),
              isMine: msg.senderId === myUserId,
            },
          }));
        })
      );
    } catch (err) {
      console.error("[AdminChat] Failed to load rooms:", err);
    }
  }, [accessToken, myUserId]);

  // Fetch admin's own profile once for avatar display on "mine" bubbles
  useEffect(() => {
    const userId = session?.user?.id;
    if (!accessToken || !userId) return;
    userService.getUserWithMedia(userId, accessToken).then((res) => {
      if (res?.data) {
        const d = res.data;
        const name =
          [d.lastName, d.firstName].filter(Boolean).join(" ") ||
          d.username ||
          d.email ||
          "Tôi";
        setMyProfile({ name, avatarUrl: getAvatarUrl(d.userMedia) ?? d.image });
      }
    }).catch(() => {/* silently ignore */});
  }, [accessToken, session?.user?.id]);

  useEffect(() => {
    if (!accessToken) return;
    setRoomsLoading(true);
    loadRooms().finally(() => setRoomsLoading(false));

    const interval = setInterval(loadRooms, 30_000);
    return () => clearInterval(interval);
  }, [accessToken, loadRooms]);

  // Auto-select room when navigated from users page via ?room= param
  useEffect(() => {
    if (!initialRoom || activeRoom || roomsLoading) return;
    const found = [...joinedRooms, ...queueRooms].find((r) => r.name === initialRoom);
    if (!found) return;
    if (queueRooms.some((r) => r.id === found.id)) {
      handlePickFromQueue(found);
    } else {
      selectRoom(found);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom, joinedRooms, queueRooms, roomsLoading]);

  // Classify message sender.
  // Historical messages carry senderEmail = String(senderId) — compare to numeric customerId.
  // Real-time WS messages carry senderEmail = sender's email — look up in senderProfiles cache.
  function classifyMessage(msg: ChatMessage, customerId: string | null): SenderKind {
    if (msg.isMine) return "mine";
    if (customerId && msg.senderEmail === customerId) return "customer"; // history (numeric ID match)
    if (customerId && senderProfiles[customerId]?.email === msg.senderEmail) return "customer"; // real-time (email match)
    return "colleague";
  }

  // Load message history when active room changes
  useEffect(() => {
    if (!activeRoom || !accessToken) return;

    const customerIdMatch = activeRoom.name.match(/^support-(\d+)$/);
    const customerId = customerIdMatch?.[1] ?? null;

    async function loadMessages() {
      if (!activeRoom || !accessToken) return;
      pageRef.current = 1;
      hasMoreRef.current = true;
      setMessagesLoading(true);
      setMessages([]);
      loadCustomerProfile();
      try {
        const res = await chatService.getRoomMessages(activeRoom.name, accessToken, 1);
        if (res?.data) {
          const raw = res.data as ChatMessageDto[];
          const history = raw
            .slice()
            .reverse()
            .map((m) => ({
              id: `hist-${m.id}`,
              senderEmail: String(m.senderId),
              text: m.content,
              isMine: m.senderId === myUserId,
              timestamp: new Date(m.createdAt),
              productAttachment: parseProductCard(m.content) ?? undefined,
            }));
          setMessages(history);
          await loadColleagueProfiles(history);
        }
      } catch (err) {
        console.error("[AdminChat] Failed to load messages:", err);
      } finally {
        setMessagesLoading(false);
        // If content doesn't overflow the container, scrollTop stays at 0 and onScroll
        // never fires — proactively load more so the user isn't stuck.
        requestAnimationFrame(() => {
          const container = scrollContainerRef.current;
          if (container && hasMoreRef.current && container.scrollTop < 80) {
            loadMoreMessages();
          }
        });
      }
    }

    // Fetch customer profile for avatar + name + email (email needed to classify real-time WS messages)
    async function loadCustomerProfile() {
      if (!customerId || !accessToken) return;
      try {
        const res = await userService.getUserWithMedia(customerId, accessToken);
        if (res?.data) {
          const d = res.data;
          const name =
            [d.lastName, d.firstName].filter(Boolean).join(" ") ||
            d.username ||
            d.email ||
            `Khách hàng #${customerId}`;
          const profileAvatarUrl = getAvatarUrl(d.userMedia) ?? d.image;
          setSenderProfiles((prev) => ({
            ...prev,
            [customerId]: { name, avatarUrl: profileAvatarUrl, email: d.email ?? undefined },
          }));
        }
      } catch {
        // silently ignore
      }
    }

    // Fetch profiles for any colleague (admin) senders found in history
    async function loadColleagueProfiles(msgs: ChatMessage[]) {
      if (!accessToken) return;
      const seen = new Set<string>();
      for (const msg of msgs) {
        if (msg.isMine) continue;
        if (customerId && msg.senderEmail === customerId) continue;
        if (seen.has(msg.senderEmail) || senderProfiles[msg.senderEmail]) continue;
        seen.add(msg.senderEmail);
        try {
          const res = await userService.getUserWithMedia(msg.senderEmail, accessToken);
          if (res?.data) {
            const d = res.data;
            const name =
              [d.lastName, d.firstName].filter(Boolean).join(" ") ||
              d.username ||
              d.email ||
              "Đồng nghiệp";
            const profileAvatarUrl = getAvatarUrl(d.userMedia) ?? d.image;
            setSenderProfiles((prev) => ({
              ...prev,
              [msg.senderEmail]: { name, avatarUrl: profileAvatarUrl },
            }));
          }
        } catch {
          // silently ignore
        }
      }
    }

    loadMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, accessToken, myUserId]);

  async function loadMoreMessages() {
    if (!hasMoreRef.current || loadingMoreRef.current || !activeRoom || !accessToken) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const res = await chatService.getRoomMessages(activeRoom.name, accessToken, nextPage);
      const older = (res?.data as ChatMessageDto[]) ?? [];
      if (older.length === 0) { hasMoreRef.current = false; return; }
      pageRef.current = nextPage;
      const mapped = older.slice().reverse().map((m) => ({
        id: `hist-${m.id}`,
        senderEmail: String(m.senderId),
        text: m.content,
        isMine: m.senderId === myUserId,
        timestamp: new Date(m.createdAt),
        productAttachment: parseProductCard(m.content) ?? undefined,
      }));
      const container = scrollContainerRef.current;
      const prevHeight = container?.scrollHeight ?? 0;
      setMessages((prev) => [...mapped, ...prev]);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight;
      });
    } catch (err) {
      console.error("[AdminChat] Failed to load more messages:", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  function handleMessagesScroll(e: React.UIEvent<HTMLDivElement>) {
    if (e.currentTarget.scrollTop < 80) loadMoreMessages();
  }

  function selectRoom(room: ChatRoomDto) {
    setActiveRoom(room);
    setUnreadCounts((prev) => {
      if (!prev[room.name]) return prev;
      const next = { ...prev };
      delete next[room.name];
      return next;
    });
  }

  // Admin picks a room from the queue → join via WS + move to active
  function handlePickFromQueue(room: ChatRoomDto) {
    joinRoom(room.name);
    // Optimistically move from queue to joined
    setQueueRooms((prev) => prev.filter((r) => r.id !== room.id));
    setJoinedRooms((prev) => {
      if (prev.some((r) => r.id === room.id)) return prev;
      return [room, ...prev];
    });
    selectRoom(room);
  }

  function handleSend() {
    if (!connected || !activeRoom || myUserId === null) return;

    if (pendingProduct) {
      const text = serializeProductCard(pendingProduct);
      const sent = activeRoom.isPrivate
        ? sendPrivateMessage(getPeerUserId(activeRoom, myUserId) ?? "", text)
        : sendRoomMessage(activeRoom.name, text);
      if (!sent) return;
      const now = new Date();
      const optimistic: ChatMessage = {
        id: `opt-${Date.now()}`,
        senderEmail: currentUserEmail ?? "admin",
        text,
        isMine: true,
        timestamp: now,
        productAttachment: pendingProduct,
      };
      setMessages((prev) => [...prev, optimistic]);
      setLastMessages((prev) => ({ ...prev, [activeRoom.name]: { text, timestamp: now, isMine: true } }));
      setPendingProduct(null);
      return;
    }

    const text = input.trim();
    if (!text) return;

    let sent = false;
    if (activeRoom.isPrivate) {
      const peerId = getPeerUserId(activeRoom, myUserId);
      if (!peerId) return;
      sent = sendPrivateMessage(peerId, text);
    } else {
      sent = sendRoomMessage(activeRoom.name, text);
    }

    if (!sent) return;

    const now = new Date();
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderEmail: currentUserEmail ?? "admin",
      text,
      isMine: true,
      timestamp: now,
    };
    setMessages((prev) => [...prev, optimistic]);
    setLastMessages((prev) => ({ ...prev, [activeRoom.name]: { text, timestamp: now, isMine: true } }));
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getRoomLabel(room: ChatRoomDto): string {
    if (room.isPrivate) return getPeerLabel(room.name, currentUserEmail ?? "");
    return getSupportRoomLabel(room);
  }

  return (
    <div className="flex h-full bg-white rounded-lg overflow-hidden shadow">
      {/* Left panel — room list */}
      <div className={`w-full md:w-72 border-r border-gray-200 flex-col flex-shrink-0 ${activeRoom ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-lg">Chat</h1>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {connected ? (
                <>
                  <Wifi size={13} className="text-green-500" /> Trực tuyến
                </>
              ) : (
                <>
                  <WifiOff size={13} className="text-red-400" /> Ngoại tuyến
                </>
              )}
            </div>
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {roomsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--admin-green-dark)]" />
            </div>
          ) : (
            <>
              {/* Queue section — sorted by latest message */}
              {queueRooms.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[11px] font-semibold text-[var(--admin-green-dark)] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={11} />
                    Chờ xử lý ({queueRooms.length})
                  </div>
                  {[...queueRooms]
                    .sort((a, b) => {
                      const ta = lastMessages[a.name]?.timestamp ?? new Date(a.createdAt);
                      const tb = lastMessages[b.name]?.timestamp ?? new Date(b.createdAt);
                      return tb.getTime() - ta.getTime();
                    })
                    .map((room) => (
                      <QueueRoomItem
                        key={room.id}
                        room={room}
                        label={getRoomLabel(room)}
                        lastMessage={lastMessages[room.name]}
                        unreadCount={unreadCounts[room.name] ?? 0}
                        onClick={() => handlePickFromQueue(room)}
                      />
                    ))}
                </div>
              )}

              {/* Active / joined section — sorted by latest message */}
              {joinedRooms.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Đang xử lý ({joinedRooms.length})
                  </div>
                  {[...joinedRooms]
                    .sort((a, b) => {
                      const ta = lastMessages[a.name]?.timestamp ?? new Date(a.createdAt);
                      const tb = lastMessages[b.name]?.timestamp ?? new Date(b.createdAt);
                      return tb.getTime() - ta.getTime();
                    })
                    .map((room) => (
                      <ActiveRoomItem
                        key={room.id}
                        room={room}
                        label={getRoomLabel(room)}
                        active={activeRoom?.id === room.id}
                        lastMessage={lastMessages[room.name]}
                        unreadCount={unreadCounts[room.name] ?? 0}
                        onClick={() => selectRoom(room)}
                      />
                    ))}
                </div>
              )}

              {queueRooms.length === 0 && joinedRooms.length === 0 && (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">
                  Chưa có cuộc trò chuyện nào
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right panel — chat area */}
      {activeRoom ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-3 sm:px-6 py-4 border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setActiveRoom(null)}
              className="md:hidden p-1.5 -ml-1 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600"
              aria-label="Quay lại"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="w-9 h-9 rounded-md bg-[var(--admin-green-mid)] flex items-center justify-center text-[var(--admin-green-dark)] text-sm font-bold shrink-0">
              {activeRoom.isPrivate ? (
                getPeerLabel(activeRoom.name, currentUserEmail ?? "")
                  .charAt(0)
                  .toUpperCase()
              ) : (
                <Users size={16} />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate text-[var(--admin-green-dark)]">
                {getRoomLabel(activeRoom)}
              </p>
              {!activeRoom.isPrivate && (
                <p className="text-xs text-gray-400 truncate">
                  {activeRoom.name}
                </p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-gray-50"
          >
            {loadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 size={14} className="animate-spin text-gray-400" />
              </div>
            )}
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">
                  Chưa có tin nhắn. Hãy bắt đầu trò chuyện.
                </p>
              </div>
            ) : (
              <MessageList
                messages={messages}
                myUserId={myUserId}
                activeRoom={activeRoom}
                senderProfiles={senderProfiles}
                myProfile={myProfile}
                classifyMessage={classifyMessage}
                onProductCardClick={(id) => setProductDetailId(id)}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending product preview */}
          {pendingProduct && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <ProductMessageCard attachment={pendingProduct} isMine={false} />
              </div>
              <button
                onClick={() => setPendingProduct(null)}
                className="text-gray-400 hover:text-black cursor-pointer shrink-0"
                aria-label="Huỷ đính kèm sản phẩm"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 bg-white flex items-center px-2 flex-shrink-0">
            <button
              onClick={() => setPickerOpen(true)}
              disabled={!connected}
              className="cursor-pointer p-2.5 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Đính kèm sản phẩm"
              title="Đính kèm sản phẩm"
            >
              <Package size={18} />
            </button>
            {!pendingProduct && (
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={connected ? "Nhập tin nhắn…" : "Đang kết nối…"}
                disabled={!connected}
                className="flex-1 px-2 py-3.5 text-sm outline-none bg-transparent disabled:opacity-50 placeholder:text-gray-400"
              />
            )}
            {pendingProduct && <div className="flex-1" />}
            <button
              onClick={handleSend}
              disabled={!connected || (!pendingProduct && !input.trim())}
              className="cursor-pointer p-3 text-black hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>

          {accessToken && (
            <ProductPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(att) => { setPendingProduct(att); setPickerOpen(false); }}
              accessToken={accessToken}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-gray-50 text-gray-400">
          <MessageSquare size={48} className="mb-3 opacity-30" />
          <p className="text-sm">Chọn cuộc trò chuyện để bắt đầu</p>
        </div>
      )}

      {/* Product detail modal — opened when admin clicks a product card bubble */}
      <Dialog open={productDetailId !== null} onOpenChange={(open) => { if (!open) setProductDetailId(null); }}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-[1400px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Chi tiết sản phẩm</DialogTitle>
          </DialogHeader>
          {productDetailId !== null && (
            <ProductForm
              productId={productDetailId}
              onSuccess={() => setProductDetailId(null)}
              onCancel={() => setProductDetailId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Message list with Messenger-style grouping and avatar circles
function MessageList({
  messages,
  myUserId,
  activeRoom,
  senderProfiles,
  myProfile,
  classifyMessage,
  onProductCardClick,
}: {
  messages: ChatMessage[];
  myUserId: number | null;
  activeRoom: ChatRoomDto | null;
  senderProfiles: Record<string, SenderProfile>;
  myProfile: SenderProfile | null;
  classifyMessage: (msg: ChatMessage, customerId: string | null) => SenderKind;
  onProductCardClick?: (productId: number) => void;
}) {
  const customerIdMatch = activeRoom?.name.match(/^support-(\d+)$/);
  const customerId = customerIdMatch?.[1] ?? null;

  // Normalize real-time messages: WS carries sender email, history carries numeric senderId.
  // Map email → numeric ID so grouping and profile lookup are consistent.
  const normalizedMessages = messages.map((msg) => {
    if (customerId && !msg.isMine && senderProfiles[customerId]?.email === msg.senderEmail) {
      return { ...msg, senderEmail: customerId };
    }
    return msg;
  });

  // Group consecutive messages from the same sender
  type Group = { senderId: string; kind: SenderKind; msgs: ChatMessage[] };
  const groups: Group[] = [];
  for (const msg of normalizedMessages) {
    const kind = classifyMessage(msg, customerId);
    const senderId = msg.senderEmail;
    const last = groups[groups.length - 1];
    if (last && last.senderId === senderId) {
      last.msgs.push(msg);
    } else {
      groups.push({ senderId, kind, msgs: [msg] });
    }
  }

  return (
    <div className="space-y-1">
      {groups.map((group, gi) => {
        const profile =
          group.kind === "mine"
            ? myProfile
            : senderProfiles[group.senderId];
        const senderName =
          profile?.name ??
          (customerId && group.senderId === customerId
            ? `Khách hàng #${customerId}`
            : group.kind === "colleague"
            ? "Đồng nghiệp"
            : group.senderId);
        const avatarUrl = profile?.avatarUrl;

        // Only MY messages go on the right — customer and colleague both go left
        const isRight = group.kind === "mine";

        return (
          <div
            key={`group-${gi}`}
            className={`flex flex-col gap-0.5 mb-3 ${isRight ? "items-end" : "items-start"}`}
          >
            {/* Sender name — always visible for customer and colleague */}
            {group.kind !== "mine" && (
              <p className="text-[11px] text-gray-400 ml-9 mb-0.5">{senderName}</p>
            )}

            {group.msgs.map((msg, mi) => {
              const isLast = mi === group.msgs.length - 1;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isRight ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar — left side only, shown on last bubble of each group */}
                  <div className={`w-7 h-7 shrink-0 ${isLast ? "visible" : "invisible"}`}>
                    {isLast && (
                      avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={senderName}
                          width={28}
                          height={28}
                          className="rounded-full object-cover w-7 h-7"
                          unoptimized
                        />
                      ) : (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            group.kind === "colleague" ? "bg-indigo-500" : "bg-gray-300"
                          }`}
                        >
                          {senderName.charAt(0).toUpperCase()}
                        </div>
                      )
                    )}
                  </div>

                  {/* Bubble */}
                  {msg.productAttachment ? (
                    <ProductMessageCard
                      attachment={msg.productAttachment}
                      isMine={isRight}
                      colleague={group.kind === "colleague"}
                      timestamp={msg.timestamp}
                      onCardClick={onProductCardClick ? () => onProductCardClick(msg.productAttachment!.productId) : undefined}
                    />
                  ) : (
                    <div
                      className={`max-w-[70%] px-4 py-2.5 text-sm rounded-lg ${
                        group.kind === "mine"
                          ? "bg-[var(--admin-green-dark)] text-white"
                          : group.kind === "colleague"
                          ? "bg-indigo-500 text-white"
                          : "bg-white border border-gray-200 text-black"
                      }`}
                    >
                      <p className="leading-snug">{msg.text}</p>
                      <p className="text-[10px] mt-1 text-right opacity-50">
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Queue room — unjoined, needs attention
function QueueRoomItem({
  room,
  label,
  lastMessage,
  unreadCount,
  onClick,
}: {
  room: ChatRoomDto;
  label: string;
  lastMessage?: LastMessage;
  unreadCount: number;
  onClick: () => void;
}) {
  const isNew = (Date.now() - new Date(room.createdAt).getTime()) < 10 * 60 * 1000;
  const ts = lastMessage?.timestamp ?? new Date(room.createdAt);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer bg-[var(--admin-green-light)] hover:bg-[var(--admin-green-mid)] border-l-2 border-[var(--admin-green-dark)]"
    >
      <div className="relative w-9 h-9 rounded-md bg-[var(--admin-green-mid)] flex items-center justify-center text-[var(--admin-green-dark)] text-sm font-bold shrink-0">
        <Users size={16} />
        {isNew && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--admin-green-dark)] rounded-full animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <p className="text-sm font-medium truncate text-[var(--admin-green-dark)]">{label}</p>
          <span className="text-[10px] text-[var(--admin-green-dark)] opacity-50 shrink-0">{relativeTime(ts)}</span>
        </div>
        <p className="text-[11px] text-[var(--admin-green-dark)] opacity-60 truncate mt-0.5">
          {lastMessage ? (lastMessage.isMine ? "Bạn: " : "") + previewText(lastMessage.text) : (isNew ? "Mới" : "Chưa có tin nhắn")}
        </p>
      </div>
      {unreadCount > 0 && (
        <span className="ml-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

// Active room — already joined
function ActiveRoomItem({
  room,
  label,
  active,
  lastMessage,
  unreadCount,
  onClick,
}: {
  room: ChatRoomDto;
  label: string;
  active: boolean;
  lastMessage?: LastMessage;
  unreadCount: number;
  onClick: () => void;
}) {
  const ts = lastMessage?.timestamp ?? new Date(room.createdAt);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-l-2 ${
        active
          ? "bg-[var(--admin-green-mid)] border-[var(--admin-green-dark)]"
          : "hover:bg-[var(--admin-green-light)] border-transparent"
      }`}
    >
      <div className={`w-9 h-9 rounded-md flex items-center justify-center text-sm font-bold shrink-0 ${
        active
          ? "bg-[var(--admin-green-dark)] text-white"
          : "bg-[var(--admin-green-mid)] text-[var(--admin-green-dark)]"
      }`}>
        {room.isPrivate ? (
          label.charAt(0).toUpperCase()
        ) : (
          <Users size={16} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <p className={`text-sm truncate ${
            active ? "font-semibold text-[var(--admin-green-dark)]" : "font-medium text-gray-700"
          }`}>
            {label}
          </p>
          <span className={`text-[10px] shrink-0 ${active ? "text-[var(--admin-green-dark)] opacity-60" : "text-gray-400"}`}>
            {relativeTime(ts)}
          </span>
        </div>
        {lastMessage && (
          <p className={`text-[11px] truncate mt-0.5 ${
            !active && unreadCount > 0 ? "font-semibold text-gray-700" : "text-gray-400"
          }`}>
            {lastMessage.isMine ? "Bạn: " : ""}{previewText(lastMessage.text)}
          </p>
        )}
      </div>
      {!active && unreadCount > 0 && (
        <span className="ml-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
