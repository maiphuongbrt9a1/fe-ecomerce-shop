"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, MessageCircle } from "lucide-react";
import { userService, type UserDto } from "@/services/user";
import { chatService } from "@/services/chat";
import { toast } from "sonner";
import UserDetailCard, { EmptyUserDetailCard } from "./UserDetailCard";

// ── Constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 57;
const PER_PAGE   = 20;

// ── Types & helpers ─────────────────────────────────────────────────────────

type UserStatus = "ACTIVE" | "INACTIVE" | "VIP";

const STATUS_CONFIG: Record<UserStatus, { label: string; textColor: string; dotClass: string }> = {
  ACTIVE:   { label: "Hoạt động",       textColor: "#21c45d", dotClass: "bg-[#21c45d]" },
  INACTIVE: { label: "Không hoạt động", textColor: "#ef4343", dotClass: "bg-[#ef4343]" },
  VIP:      { label: "VIP",             textColor: "#fbbd23", dotClass: "bg-[#fbbd23]" },
};

function getStatus(user: UserDto): UserStatus {
  if (user.status) return user.status;
  return user.isActive ? "ACTIVE" : "INACTIVE";
}

function getDisplayName(user: UserDto): string {
  return (
    [user.lastName, user.firstName].filter(Boolean).join(" ") ||
    user.name ||
    user.username ||
    "—"
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AdminUsersClient() {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";
  const router = useRouter();

  // ── List state ──
  const [users, setUsers]               = useState<UserDto[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);

  // ── Search (debounced, client-side filter on accumulated list) ──
  const [searchInput, setSearchInput]   = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Selected user ──
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // ── Fetch all pages on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setUsers([]);
      const all: UserDto[] = [];
      let page = 1;
      try {
        while (!cancelled) {
          console.log("[AdminUsers] Fetching page:", page);
          const res = await userService.getUsers(page, PER_PAGE, accessToken);
          const data = Array.isArray(res?.data) ? res.data : [];
          console.log("[AdminUsers] Page", page, "→ got", data.length, "items");
          if (data.length === 0) break;
          all.push(...data);
          if (cancelled) return;
          if (page === 1) {
            setUsers(all.slice());
            setLoading(false);
            setLoadingMore(true);
          } else {
            setUsers(all.slice());
          }
          if (data.length < PER_PAGE) break;
          page += 1;
        }
        if (!cancelled) console.log("[AdminUsers] Done. Total:", all.length);
      } catch (err) {
        console.error("[AdminUsers] Fetch error:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // ── Search ───────────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setAppliedSearch(value), 300);
  };

  const filteredUsers = appliedSearch.trim()
    ? users.filter((u) => {
        const q = appliedSearch.toLowerCase();
        return (
          `#${String(u.id).padStart(4, "0")}`.includes(q) ||
          getDisplayName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone ?? "").includes(q)
        );
      })
    : users;

  // ── Virtualizer ──────────────────────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  const handleOpenChat = async (e: React.MouseEvent, user: UserDto) => {
    e.stopPropagation();
    if (!accessToken) return;
    const roomName = `support-${user.id}`;
    try {
      await chatService.createPublicRoom(
        { name: roomName, description: getDisplayName(user) },
        accessToken
      );
      // Room was just created — add the customer as a member too
      await chatService.addUserToRoom({ roomName, userId: user.id }, accessToken);
    } catch {
      // Room already exists — navigate to it
    }
    router.push(`/admin/chat?room=${roomName}`);
  };

  // ── Select user ──────────────────────────────────────────────────────────
  const handleSelectUser = useCallback((user: UserDto) => {
    setSelectedUser(user);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-4 md:p-6 flex flex-col lg:flex-row gap-4 lg:gap-5 h-full min-h-0">
      {/* Left: virtual table */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <div>
          <h1 className="text-xl font-bold text-[#023337]">Quản lý khách hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Xem thông tin và quản lý tài khoản người dùng
          </p>
        </div>

        <input
          type="text"
          placeholder="Tìm theo ID, tên, email, số điện thoại..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full px-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--admin-green-mid)] placeholder:text-gray-400"
        />

        <div className="bg-white shadow rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
            <div className="min-w-[820px] flex flex-col flex-1 min-h-0">
          {/* Fixed header */}
          <div className="bg-[#eaf8e7] flex items-center gap-4 px-2 rounded-t-lg shrink-0">
            {(["ID Khách Hàng", "Tên", "Email", "Số điện thoại", "Tình trạng"] as const).map((col) => (
              <div key={col} className="flex-1 flex items-center justify-center h-[40px] px-[10px]">
                <span className="text-[15px] font-medium text-[#023337] whitespace-nowrap">{col}</span>
              </div>
            ))}
            <div className="w-[79px] flex items-center justify-center h-[40px]">
              <span className="text-[15px] font-medium text-[#023337]">Hành động</span>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div ref={tableContainerRef} className="flex-1 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                  Không tìm thấy khách hàng
                </div>
              ) : (
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                  {rowVirtualizer.getVirtualItems().map((vRow) => {
                    const user       = filteredUsers[vRow.index];
                    const statusCfg  = STATUS_CONFIG[getStatus(user)];
                    const isSelected = selectedUser?.id === user.id;

                    return (
                      <div
                        key={user.id}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: `${ROW_HEIGHT}px`,
                          transform: `translateY(${vRow.start}px)`,
                        }}
                        className={`flex items-center gap-4 px-2 border-b border-[#d1d5db] cursor-pointer transition-colors ${
                          isSelected ? "bg-[var(--admin-green-light)]" : "hover:bg-gray-50"
                        }`}
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className="flex-1 flex items-center justify-center px-[10px]">
                          <span className="text-[15px] text-black">#{String(user.id).padStart(4, "0")}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center px-[12px]">
                          <span className="text-[15px] text-black truncate max-w-full">{getDisplayName(user)}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center px-[10px]">
                          <span className="text-[15px] text-black truncate max-w-full">{user.email}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center px-[10px]">
                          <span className="text-[15px] text-black">{user.phone || "—"}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center px-[10px]">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dotClass}`} />
                            <span className="text-[15px] whitespace-nowrap" style={{ color: statusCfg.textColor }}>
                              {statusCfg.label}
                            </span>
                          </div>
                        </div>
                        <div className="w-[79px] flex items-center justify-center">
                          <button
                            className="p-1 hover:bg-[var(--admin-green-light)] rounded cursor-pointer text-gray-500 hover:text-[#023337] transition-colors"
                            onClick={(e) => handleOpenChat(e, user)}
                            title="Mở chat"
                          >
                            <MessageCircle size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {loadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: detail card */}
      <div className="w-full lg:w-[306px] shrink-0 lg:pt-[68px]">
        {selectedUser ? (
          <UserDetailCard user={selectedUser} />
        ) : (
          <EmptyUserDetailCard />
        )}
      </div>
    </div>
  );
}
