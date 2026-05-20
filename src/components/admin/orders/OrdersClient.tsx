"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Loader2 } from "lucide-react";
import { orderService, type OrderListFilter } from "@/services/order";
import type { OrderFullInformationEntity } from "@/dto/order";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { STATUS_CONFIG } from "@/app/admin/orders/_components/orderStatusConfig";
import OrderDetailSheet from "@/app/admin/orders/_components/OrderDetailSheet";
import RowImage from "@/components/RowImage";
import { getReturnRequestOverlay } from "@/utils/returnRequestStatus";
import { Undo2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

const ROW_HEIGHT = 56;
const COLS = "48px 2fr 160px 140px 120px 120px 160px 130px";

type FilterTab = OrderListFilter;

// One tab per OrderStatus so the filter is 1:1 with the Status column.
// Order mirrors the order lifecycle, with the cross-cutting return-request
// tab slotted right before RETURNED.
const TAB_ORDER: { value: FilterTab; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "PAYMENT_PROCESSING", label: "Đang thanh toán" },
  { value: "PAYMENT_CONFIRMED", label: "Đã xác nhận" },
  { value: "WAITING_FOR_PICKUP", label: "Chờ lấy hàng" },
  { value: "SHIPPED", label: "Đang giao" },
  { value: "DELIVERED", label: "Đã giao" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "DELIVERED_FAILED", label: "Giao thất bại" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "pending_return", label: "Yêu cầu trả hàng" },
  { value: "RETURNED", label: "Hoàn tiền" },
];

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function OrdersClient() {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";

  const [orders, setOrders] = useState<OrderFullInformationEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderFullInformationEntity | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // BE filters by tab + search; FE just renders what the server returns.
  // requestTokenRef discards stale requests when the user changes tab or types
  // faster than the network can keep up.
  const debouncedSearch = useDebounce(searchQuery, 300);
  const requestTokenRef = useRef(0);
  const pageRef = useRef(1);

  // Initial load + reload when tab/search changes. Resets to page 1.
  // hasMore is only flipped to false when BE returns an empty page — we
  // don't trust any specific page-size guess.
  const resetAndFetch = useCallback(
    async (tab: FilterTab, search: string) => {
      if (!accessToken) return;
      const token = ++requestTokenRef.current;
      setLoading(true);
      // Clear any stale loadingMore from a fetchMore that was in flight
      // when the user switched tabs. Otherwise the scroll trigger stays
      // gated by !loadingMore and never fires again on the new tab.
      setLoadingMore(false);
      setOrders([]);
      pageRef.current = 1;
      setHasMore(true);
      try {
        const res = await orderService.getAllOrderDetails(1, accessToken, {
          statusFilter: tab,
          search,
        });
        if (token !== requestTokenRef.current) return;
        const data = Array.isArray(res.data) ? res.data : [];
        console.log("[OrdersClient] Reset fetch page 1:", { tab, search, count: data.length });
        setOrders(data);
        setHasMore(data.length > 0);
      } catch (err) {
        console.error("[OrdersClient] Fetch error:", err);
      } finally {
        if (token === requestTokenRef.current) {
          setLoading(false);
        }
      }
    },
    [accessToken],
  );

  // Infinite scroll: fetch next page when user scrolls near the end.
  // Stop only when BE returns 0 items.
  const fetchMore = useCallback(async () => {
    if (!accessToken) return;
    const token = requestTokenRef.current;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const res = await orderService.getAllOrderDetails(nextPage, accessToken, {
        statusFilter: activeTab,
        search: debouncedSearch,
      });
      if (token !== requestTokenRef.current) return;
      const data = Array.isArray(res.data) ? res.data : [];
      console.log("[OrdersClient] Fetch more page:", nextPage, "count:", data.length);
      if (data.length > 0) {
        setOrders((prev) => [...prev, ...data]);
        pageRef.current = nextPage;
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[OrdersClient] Fetch more error:", err);
    } finally {
      // Always clear — leaving it true on a stale call freezes the trigger.
      setLoadingMore(false);
    }
  }, [accessToken, activeTab, debouncedSearch]);

  useEffect(() => {
    resetAndFetch(activeTab, debouncedSearch);
  }, [resetAndFetch, activeTab, debouncedSearch]);

  const rowVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // Trigger fetchMore when the last few virtual items come into view.
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= orders.length - 5 && hasMore && !loadingMore && !loading) {
      fetchMore();
    }
  }, [virtualItems, orders.length, hasMore, loadingMore, loading, fetchMore]);

  const handleOrderUpdated = (updated: OrderFullInformationEntity) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setSelectedOrder(updated);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 flex flex-col gap-4 h-full min-h-0">
      <h1 className="text-xl sm:text-2xl font-bold text-[var(--admin-green-dark)]">
        Quản lý đơn hàng
      </h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="bg-[var(--admin-green-light)] w-max">
            {TAB_ORDER.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="cursor-pointer">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Tìm theo mã đơn, khách hàng..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
        <div className="min-w-[1100px] flex flex-col flex-1 min-h-0">
          <div
            style={{ display: "grid", gridTemplateColumns: COLS }}
            className="bg-[var(--admin-green-light)] rounded-lg px-4 py-2 text-sm font-semibold text-[var(--admin-green-dark)] flex-shrink-0"
          >
            <div className="flex items-center">#</div>
            <div className="flex items-center">Sản phẩm</div>
            <div className="flex items-center">Khách hàng</div>
            <div className="flex items-center">Thời gian</div>
            <div className="flex items-center">Giá</div>
            <div className="flex items-center">Phương thức</div>
            <div className="flex items-center">Mã vận đơn</div>
            <div className="flex items-center">Tình trạng</div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-[var(--admin-green-dark)] w-8 h-8" />
            </div>
          ) : (
            <div
              ref={tableContainerRef}
              className="overflow-y-auto flex-1 relative border border-gray-200 rounded-lg min-h-0 mt-2"
            >
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const order = orders[vi.index];
              const firstItem = order.orderItems?.[0];
              const thumbUrl = firstItem?.productVariant?.media?.[0]?.url ?? null;
              const productName = firstItem?.productVariant?.variantName ?? "—";
              const paymentMethod = order.payment?.[0]?.paymentMethod ?? "—";
              const shipment = order.shipments?.[0];
              const trackingCode = shipment?.ghnOrderCode ?? shipment?.trackingNumber ?? "—";
              const statusCfg = STATUS_CONFIG[order.status];
              const StatusIcon = statusCfg.icon;
              const returnOverlay = getReturnRequestOverlay(order);

              return (
                <div
                  key={order.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${vi.start}px)`,
                    display: "grid",
                    gridTemplateColumns: COLS,
                    width: "100%",
                    height: ROW_HEIGHT,
                  }}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer hover:bg-gray-50 border-b border-gray-100 px-4 items-center text-sm"
                >
                  <div className="text-gray-400 text-xs">{vi.index + 1}</div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                      <RowImage src={thumbUrl ?? null} alt={productName} size={32} />
                    </div>
                    <span className="truncate text-gray-700">{productName}</span>
                  </div>
                  <div className="text-gray-600 truncate">
                    {[order.user?.lastName, order.user?.firstName].filter(Boolean).join(" ") || order.user?.email || `#${order.userId}`}
                  </div>
                  <div className="text-gray-600">{formatDate(order.orderDate)}</div>
                  <div className="text-gray-800 font-medium">
                    {order.totalAmount.toLocaleString("vi-VN")}đ
                  </div>
                  <div className="text-gray-600 truncate">{paymentMethod}</div>
                  <div className="text-gray-600 truncate font-mono text-xs">{trackingCode}</div>
                  <div className="flex flex-col gap-0.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-xs font-medium" style={{ color: statusCfg.color }}>
                      <StatusIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      {statusCfg.label}
                    </div>
                    {returnOverlay && (
                      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-semibold w-fit ${returnOverlay.className}`}>
                        <Undo2 className="w-3 h-3" />
                        {returnOverlay.shortLabel}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-gray-400 w-5 h-5" />
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Không có đơn hàng nào
            </div>
          )}
            </div>
          )}
        </div>
      </div>

      <OrderDetailSheet
        order={selectedOrder}
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
