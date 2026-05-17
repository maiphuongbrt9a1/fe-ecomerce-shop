"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Loader2 } from "lucide-react";
import { orderService } from "@/services/order";
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
const PER_PAGE = 10;
const COLS = "48px 2fr 160px 140px 120px 120px 160px 130px";

type FilterTab =
  | "all"
  | "waiting"
  | "shipping"
  | "delivered"
  | "pending_return"
  | "returned"
  | "cancelled";

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

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderFullInformationEntity | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // BE filters by tab + search; FE just renders what the server returns.
  // requestTokenRef discards stale pagination loops if the user changes tab or
  // types faster than the network can keep up.
  const debouncedSearch = useDebounce(searchQuery, 300);
  const requestTokenRef = useRef(0);

  const fetchOrders = useCallback(
    async (tab: FilterTab, search: string) => {
      if (!accessToken) return;
      const token = ++requestTokenRef.current;
      setLoading(true);
      setOrders([]);
      const all: OrderFullInformationEntity[] = [];
      let page = 1;
      try {
        while (true) {
          const res = await orderService.getAllOrderDetails(
            page,
            PER_PAGE,
            accessToken,
            { statusFilter: tab, search },
          );
          if (token !== requestTokenRef.current) return;
          const data = Array.isArray(res.data) ? res.data : [];
          if (data.length === 0) break;
          all.push(...data);
          if (page === 1) {
            setOrders(all.slice());
            setLoading(false);
            setLoadingMore(true);
          } else {
            setOrders(all.slice());
          }
          if (data.length < PER_PAGE) break;
          page += 1;
        }
      } catch (err) {
        console.error("[OrdersClient] Fetch error:", err);
      } finally {
        if (token === requestTokenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    fetchOrders(activeTab, debouncedSearch);
  }, [fetchOrders, activeTab, debouncedSearch]);

  const rowVirtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

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
            <TabsTrigger value="all" className="cursor-pointer">Tất cả</TabsTrigger>
            <TabsTrigger value="waiting" className="cursor-pointer">Đang chờ</TabsTrigger>
            <TabsTrigger value="shipping" className="cursor-pointer">Đang giao</TabsTrigger>
            <TabsTrigger value="delivered" className="cursor-pointer">Đã giao</TabsTrigger>
            <TabsTrigger value="pending_return" className="cursor-pointer">Yêu cầu trả hàng</TabsTrigger>
            <TabsTrigger value="returned" className="cursor-pointer">Hoàn tiền</TabsTrigger>
            <TabsTrigger value="cancelled" className="cursor-pointer">Đã hủy</TabsTrigger>
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
