import { sendRequest } from "@/utils/api";
import type { NotificationDto } from "@/dto/notification";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const notificationService = {
  async getMyNotifications(
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<NotificationDto[]>> {
    const url = `${BACKEND_URL}/notification/me`;
    // console.log("[NotificationService] Fetching notifications:", { page, perPage });
    const response = await sendRequest<IBackendRes<NotificationDto[]>>({
      url,
      method: "GET",
      queryParams: { page, perPage },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[NotificationService] Fetch response:", response);
    return response;
  },

  async getUnreadCount(accessToken: string): Promise<number> {
    const url = `${BACKEND_URL}/notification/me/unread-count`;
    const response = await sendRequest<IBackendRes<{ count: number }>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response?.data?.count ?? 0;
  },

  async markAsRead(
    accessToken: string,
    notificationId: string
  ): Promise<IBackendRes<NotificationDto>> {
    const url = `${BACKEND_URL}/notification/personal/${notificationId}/read`;
    // console.log("[NotificationService] Marking as read:", notificationId);
    const response = await sendRequest<IBackendRes<NotificationDto>>({
      url,
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[NotificationService] Mark read response:", response);
    return response;
  },
};
