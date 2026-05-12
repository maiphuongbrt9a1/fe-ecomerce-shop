"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { WsChatMessagePayload } from "@/dto/chat";
import { parseProductCard, type ProductAttachment } from "@/utils/chat-product";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

export interface ChatMessage {
  id: string;
  senderEmail: string;
  text: string;
  isMine: boolean;
  timestamp: Date;
  roomName?: string;
  productAttachment?: ProductAttachment;
}

interface UseChatSocketOptions {
  accessToken: string | null;
  currentUserEmail: string | null;
  onMessage?: (msg: ChatMessage) => void;
  onAddedToRoom?: (roomName: string) => void;
}

export function useChatSocket({
  accessToken,
  currentUserEmail,
  onMessage,
  onAddedToRoom,
}: UseChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    // console.log("[useChatSocket] Connecting to WS:", `${WS_BASE}/chat`);

    const socket = io(`${WS_BASE}/chat`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      // console.log("[useChatSocket] Connected:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      // console.log("[useChatSocket] Disconnected:", reason);
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[useChatSocket] Connection error:", err.message);
      setConnected(false);
    });

    const toMessage = (payload: WsChatMessagePayload): ChatMessage => {
      const productAttachment = parseProductCard(payload.text) ?? undefined;
      return {
        id: `ws-${Date.now()}-${Math.random()}`,
        senderEmail: payload.name,
        text: payload.text,
        isMine: payload.name === currentUserEmail,
        timestamp: new Date(),
        roomName: payload.room_name,
        productAttachment,
      };
    };

    socket.on("msgPrivateToClient", (payload: WsChatMessagePayload) => {
      onMessage?.(toMessage(payload));
    });

    socket.on("msgToRoomClient", (payload: WsChatMessagePayload) => {
      onMessage?.(toMessage(payload));
    });

    socket.on("addedToRoom", (payload: { roomName: string }) => {
      onAddedToRoom?.(payload.roomName);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const sendPrivateMessage = useCallback(
    (receiverUserId: string, text: string) => {
      if (!socketRef.current?.connected) return false;
      socketRef.current.emit("msgPrivateToServer", { text, receiver: receiverUserId });
      return true;
    },
    []
  );

  const sendRoomMessage = useCallback((roomName: string, text: string) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("msgToRoomServer", { text, room_name: roomName });
    return true;
  }, []);

  const createRoom = useCallback((name: string, description?: string) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("createNewPublicRoom", { name, description });
    return true;
  }, []);

  const joinRoom = useCallback((name: string) => {
    if (!socketRef.current?.connected) return false;
    socketRef.current.emit("joinPublicRoom", { name });
    return true;
  }, []);

  return { connected, sendPrivateMessage, sendRoomMessage, createRoom, joinRoom };
}
