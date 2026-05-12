"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import type { NotificationDto } from "@/dto/notification";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

interface PersonalNotificationPayload {
  receiverId: number;
  receiverEmail: string;
  title: string;
  content: string;
}

interface ShopNotificationPayload {
  creatorId: number;
  creatorEmail: string;
  title: string;
  content: string;
}

interface UseNotificationSocketOptions {
  accessToken: string | null;
  onNotification: (notification: NotificationDto) => void;
}

export function useNotificationSocket({
  accessToken,
  onNotification,
}: UseNotificationSocketOptions) {
  useEffect(() => {
    if (!accessToken) return;

    // console.log("[useNotificationSocket] Connecting to namespace: notification");

    const socket = io(`${WS_BASE}/notification`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      // console.log("[useNotificationSocket] Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      // console.log("[useNotificationSocket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[useNotificationSocket] Connection error:", err.message);
    });

    socket.on("personalNotificationToClient", (payload: PersonalNotificationPayload) => {
      // console.log("[useNotificationSocket] Personal notification received:", payload);
      const notification: NotificationDto = {
        id: `ws-personal-${Date.now()}`,
        title: payload.title,
        content: payload.content,
        type: "PERSONAL_NOTIFICATION",
        creatorId: null,
        recipientId: String(payload.receiverId),
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onNotification(notification);
    });

    socket.on("shopNotificationToClient", (payload: ShopNotificationPayload) => {
      // console.log("[useNotificationSocket] Shop notification received:", payload);
      const notification: NotificationDto = {
        id: `ws-shop-${Date.now()}`,
        title: payload.title,
        content: payload.content,
        type: "SHOP_NOTIFICATION",
        creatorId: String(payload.creatorId),
        recipientId: null,
        isRead: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onNotification(notification);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);
}
