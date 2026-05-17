"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useNotifications } from "@/components/notification/NotificationContext";
import { getNotificationRoute, extractOrderId } from "@/utils/notification-route";
import { Button } from "@/components/ui/button";
import RowImage from "@/components/RowImage";
import { useRouter } from "next/navigation";
import type { NotificationDto } from "@/dto/notification";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

type NotifGroup =
  | { kind: "group"; orderId: string; items: NotificationDto[] }
  | { kind: "single"; item: NotificationDto };

const formatTs = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function NotifIcon({
  notification,
  orderImageMap,
  size = "md",
}: {
  notification: NotificationDto;
  orderImageMap: Record<string, string | null>;
  size?: "sm" | "md";
}) {
  const isPersonal = notification.type === "PERSONAL_NOTIFICATION";
  const orderId = isPersonal ? extractOrderId(notification.content) : null;
  const imgUrl = orderId ? orderImageMap[orderId] : null;
  const dim = size === "sm" ? "w-7 h-7" : "w-10 h-10";
  const px = size === "sm" ? 28 : 40;
  return (
    <div
      className={`${dim} flex items-center justify-center flex-shrink-0 overflow-hidden ${
        imgUrl ? "" : isPersonal ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
      }`}
    >
      {imgUrl ? (
        <RowImage src={imgUrl} alt="" size={px} />
      ) : (
        <i className={`fa-solid ${isPersonal ? "fa-box" : "fa-tag"} ${size === "sm" ? "text-xs" : ""}`} />
      )}
    </div>
  );
}

export default function NotificationsContent() {
  const { notifications, unreadCount, hasMore, loading, orderImageMap, loadMore, markRead } =
    useNotifications();
  const router = useRouter();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const grouped = useMemo<NotifGroup[]>(() => {
    const orderMap = new Map<string, NotificationDto[]>();
    const singles: NotificationDto[] = [];

    for (const n of notifications) {
      const orderId = n.type === "PERSONAL_NOTIFICATION" ? extractOrderId(n.content) : null;
      if (orderId) {
        const bucket = orderMap.get(orderId) ?? [];
        bucket.push(n);
        orderMap.set(orderId, bucket);
      } else {
        singles.push(n);
      }
    }

    const groups: NotifGroup[] = [];
    for (const [orderId, items] of orderMap) {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      groups.push({ kind: "group", orderId, items });
    }
    const singleGroups: NotifGroup[] = singles.map((item) => ({ kind: "single", item }));

    const latestAt = (g: NotifGroup) =>
      new Date(g.kind === "group" ? g.items[0].createdAt : g.item.createdAt).getTime();

    return [...groups, ...singleGroups].sort((a, b) => latestAt(b) - latestAt(a));
  }, [notifications]);

  const toggleExpand = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const handleRowClick = (notification: NotificationDto) => {
    if (notification.type === "PERSONAL_NOTIFICATION" && !notification.isRead) {
      markRead(notification.id);
    }
    const route = getNotificationRoute(notification);
    if (route) router.push(route);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Thông báo
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({unreadCount} chưa đọc)
            </span>
          )}
        </h1>
      </div>

      {notifications.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-500">
          <i className="fa-regular fa-bell text-4xl mb-4 block" />
          <p>Chưa có thông báo nào</p>
        </div>
      ) : (
        <div className="space-y-0">
          {grouped.map((group) => {
            if (group.kind === "single") {
              const n = group.item;
              const unread = n.type === "PERSONAL_NOTIFICATION" && !n.isRead;
              return (
                <div
                  key={n.id}
                  className={`p-4 border-b transition-colors ${unread ? "bg-blue-50" : "bg-white"} ${
                    getNotificationRoute(n) ? "cursor-pointer hover:bg-gray-50" : ""
                  }`}
                  onClick={() => handleRowClick(n)}
                >
                  <div className="flex items-start gap-4">
                    <NotifIcon notification={n} orderImageMap={orderImageMap} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`text-sm ${unread ? "font-bold" : "font-medium"}`}>{n.title}</h3>
                        {unread && <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{n.content}</p>
                      <p className="text-xs text-gray-500">
                        {formatTs(n.createdAt)} · {dayjs(n.createdAt).fromNow()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // Grouped order notifications
            const { orderId, items } = group;
            const head = items[0];
            const older = items.slice(1); // newest first, earliest at bottom
            const hasHistory = older.length > 0;
            const expanded = expandedOrders.has(orderId);
            const headUnread = head.type === "PERSONAL_NOTIFICATION" && !head.isRead;
            const route = getNotificationRoute(head);

            return (
              <div key={orderId} className="border-b">
                {/* Head row — latest update */}
                <div
                  className={`p-4 transition-colors ${headUnread ? "bg-blue-50" : "bg-white"} ${
                    route ? "cursor-pointer hover:bg-gray-50" : ""
                  }`}
                  onClick={() => handleRowClick(head)}
                >
                  <div className="flex items-start gap-4">
                    <NotifIcon notification={head} orderImageMap={orderImageMap} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`text-sm ${headUnread ? "font-bold" : "font-medium"}`}>
                          {head.title}
                        </h3>
                        {headUnread && <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{head.content}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-gray-500">
                          {formatTs(head.createdAt)} · {dayjs(head.createdAt).fromNow()}
                        </p>
                        {hasHistory && (
                          <button
                            onClick={(e) => toggleExpand(orderId, e)}
                            className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                            aria-label={expanded ? "Thu gọn lịch sử" : "Xem lịch sử"}
                          >
                            <ChevronDown
                              size={14}
                              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable timeline — older updates */}
                {hasHistory && expanded && (
                  <div className="bg-gray-50 px-4 pb-3 pt-1">
                    {/* indent to align with the text content (icon 40px + gap 16px = 56px = ml-14) */}
                    <div className="ml-14 border-l border-gray-200">
                      {older.map((n) => {
                        const unread = n.type === "PERSONAL_NOTIFICATION" && !n.isRead;
                        return (
                          <div
                            key={n.id}
                            className={`relative pl-5 py-2 pr-2 transition-colors ${
                              getNotificationRoute(n) ? "cursor-pointer hover:bg-gray-100" : ""
                            }`}
                            onClick={() => handleRowClick(n)}
                          >
                            {/* Dot centered on the border-l line */}
                            <span className="absolute -left-[4.5px] top-3.5 w-2 h-2 rounded-full border-2 border-gray-300 bg-white" />
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-xs ${unread ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                                {n.title}
                              </p>
                              {unread && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {formatTs(n.createdAt)} · {dayjs(n.createdAt).fromNow()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="py-6 text-center text-sm text-gray-500">Đang tải...</div>
          )}

          {hasMore && !loading && (
            <div className="pt-4 text-center">
              <Button variant="outline" onClick={loadMore} className="cursor-pointer">
                Tải thêm
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
