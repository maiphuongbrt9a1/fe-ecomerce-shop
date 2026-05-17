"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Package, Undo2 } from "lucide-react";
import { getReturnRequestOverlay } from "@/utils/returnRequestStatus";
import MediaGallery from "@/components/common/MediaGallery";
import RowImage from "@/components/RowImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orderService } from "@/services/order";
import { shipmentService } from "@/services/shipment";
import { returnRequestService } from "@/services/returnRequest";
import type {
  OrderFullInformationEntity,
  GhnPickShift,
  RequestInOrderStatus,
} from "@/dto/order";
import { STATUS_CONFIG, STATUS_RANK } from "./orderStatusConfig";
import UserDetailCard from "@/components/admin/users/UserDetailCard";
import type { UserDto } from "@/services/user";
import { toast } from "sonner";

const RETURN_STATUS_BADGE: Record<
  RequestInOrderStatus,
  { label: string; className: string }
> = {
  PENDING:     { label: "Đang chờ",   className: "bg-[var(--status-warning-bg)] border-[var(--status-warning-border)] text-[var(--status-warning)]" },
  IN_PROGRESS: { label: "Đang xử lý", className: "bg-[var(--status-info-bg)] border-[var(--status-info-border)] text-[var(--status-info)]" },
  APPROVED:    { label: "Đã duyệt",   className: "bg-[var(--admin-green-light)] border-[var(--admin-green-mid)] text-[var(--admin-green-dark)]" },
  REJECTED:    { label: "Đã từ chối", className: "bg-[var(--status-error-bg)] border-[var(--status-error-border)] text-[var(--status-error)]" },
};

function GHNTrackingLink({ orderId, accessToken }: { orderId: number; accessToken: string }) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const res = await shipmentService.getGHNTrackingUrl(orderId, accessToken);
      if (res.data) {
        window.open(res.data, "_blank", "noopener,noreferrer"); 
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpen}
      disabled={loading}
      className="cursor-pointer w-full mt-1"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
      Tra cứu vận đơn GHN
    </Button>
  );
}

interface OrderDetailSheetProps {
  order: OrderFullInformationEntity | null;
  open: boolean;
  onClose: () => void;
  onOrderUpdated: (updated: OrderFullInformationEntity) => void;
}

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function OrderDetailSheet({
  order,
  open,
  onClose,
  onOrderUpdated,
}: OrderDetailSheetProps) {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";
  const staffId = session?.user?.id ? Number(session.user.id) : 0;
  // Return-request approval is admin-only. Order workflow steps are open to staff too.
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.isAdmin === true;

  const [submitting, setSubmitting] = useState(false);


  // GHN shift state (for Step 1)
  const [ghnShifts, setGhnShifts] = useState<GhnPickShift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [loadingShifts, setLoadingShifts] = useState(false);

  const rank = order ? (STATUS_RANK[order.status] ?? -99) : -99;

  // Terminal states exit the normal flow entirely
  const isTerminal =
    order?.status === "CANCELLED" ||
    order?.status === "DELIVERED_FAILED" ||
    order?.status === "RETURNED";

  const step1State = rank < 2 ? "pending" : rank === 2 ? "active" : "done";
  // Step 2 has two sub-states: waiting-for-pickup (action needed) vs shipped (info only)
  const step2State =
    rank < 3 ? "pending" :
    rank === 3 ? "action" :   // WAITING_FOR_PICKUP — show button
    rank === 4 ? "info" :      // SHIPPED — show tracking info
    "done";
  const step3State = rank < 4 ? "pending" : rank === 4 ? "active" : "done";

  const fetchGhnShifts = useCallback(async () => {
    if (!accessToken) return;
    setLoadingShifts(true);
    try {
      const res = await orderService.getGhnPickShifts(accessToken);
      const data = Array.isArray(res.data) ? res.data : [];
      setGhnShifts(data);
      if (data.length > 0) setSelectedShiftId(String(data[0].id));
    } catch (err) {
      console.error("[OrderDetailSheet] Failed to fetch GHN shifts:", err);
    } finally {
      setLoadingShifts(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (open && step1State === "active") {
      fetchGhnShifts();
    }
  }, [open, step1State, fetchGhnShifts]);


  if (!order) return null;

  const shipment = order.shipments?.[0];
  const payment = order.payment?.[0];
  const statusCfg = STATUS_CONFIG[order.status];
  const StatusIcon = statusCfg.icon;

  const shippingAddr = order.shippingAddress;
  const addressLine = [
    shippingAddr?.street,
    shippingAddr?.ward,
    shippingAddr?.district,
    shippingAddr?.province,
  ]
    .filter(Boolean)
    .join(", ");

  // Map order.user → UserDto shape for UserDetailCard
  const customerUser: UserDto = {
    id: order.user.id,
    firstName: order.user.firstName ?? undefined,
    lastName: order.user.lastName ?? undefined,
    email: order.user.email,
    phone: order.user.phone ?? undefined,
    username: order.user.username,
    isActive: order.user.isActive,
    image: order.user.userMedia?.find((m) => m.isAvatarFile)?.url,
  };

  async function runAction(action: () => Promise<IBackendRes<OrderFullInformationEntity>>) {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const res = await action();
      if (res.data) {
        onOrderUpdated(res.data);
      } else {
        toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("[OrderDetailSheet] Action error:", err);
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleConfirmOrder = async () => {
    const shift = ghnShifts.find((s) => String(s.id) === selectedShiftId);
    if (!shift) { toast.error("Vui lòng chọn ca lấy hàng."); return; }
    await runAction(() =>
      orderService.updateOrderToWaitingPickup(
        order.id,
        {
          processByStaffId: staffId,
          ghnPickShiftId: shift.id,
          ghnTitle: shift.title,
          ghnFromTime: shift.from_time,
          ghnToTime: shift.to_time,
        },
        accessToken
      )
    );
  };

  const handleMarkShipped = () =>
    runAction(() =>
      orderService.updateOrderToShipped(order.id, { processByStaffId: staffId }, accessToken)
    );

  const handleConfirmDelivered = () =>
    runAction(() =>
      orderService.updateOrderToDelivered(order.id, { processByStaffId: staffId }, accessToken)
    );

  const handleDeliveryFailed = () =>
    runAction(() =>
      orderService.updateOrderToDeliveryFailed(order.id, { processByStaffId: staffId }, accessToken)
    );

  const handleCancel = () => {
    if (!confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    runAction(() => orderService.cancelOrder(order.id, accessToken));
  };

  // ── Return-request review handlers ────────────────────────────────────────
  const refetchOrder = async () => {
    if (!accessToken) return;
    try {
      const fresh = await orderService.getOrderDetail(order.id, accessToken);
      if (fresh.data) onOrderUpdated(fresh.data);
    } catch (err) {
      console.error("[OrderDetailSheet] Refetch failed:", err);
    }
  };

  const patchReturnStatus = async (
    rrId: number,
    status: "IN_PROGRESS" | "APPROVED" | "REJECTED",
    successMsg: string,
  ) => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      await returnRequestService.updateStatus(
        rrId,
        { processByStaffId: staffId, status },
        accessToken,
      );
      toast.success(successMsg);
      await refetchOrder();
    } catch (err) {
      console.error("[OrderDetailSheet] updateStatus failed:", err);
      toast.error("Không thể cập nhật yêu cầu trả hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartReviewReturn = (rrId: number) =>
    patchReturnStatus(rrId, "IN_PROGRESS", "Đã bắt đầu xử lý yêu cầu.");

  const handleApproveReturn = (rrId: number) => {
    if (!confirm("Duyệt yêu cầu trả hàng? Đơn hàng sẽ được đánh dấu là đã hoàn tiền và tồn kho sẽ được hoàn trả.")) return;
    patchReturnStatus(rrId, "APPROVED", "Đã duyệt yêu cầu trả hàng.");
  };

  const handleRejectReturn = (rrId: number) => {
    if (!confirm("Từ chối yêu cầu trả hàng? Hành động này không thể hoàn tác.")) return;
    patchReturnStatus(rrId, "REJECTED", "Đã từ chối yêu cầu trả hàng.");
  };

  const returnRequest = order.requests?.find(
    (r) => r.subject === "RETURN_REQUEST",
  );
  const returnBank = returnRequest?.returnRequest?.[0];
  const returnBadge = returnRequest
    ? RETURN_STATUS_BADGE[returnRequest.status]
    : null;
  const returnOverlay = getReturnRequestOverlay(order);
  const returnMedia = returnRequest?.media ?? [];

  const canCancel =
    order.status === "PENDING" ||
    order.status === "PAYMENT_PROCESSING" ||
    order.status === "PAYMENT_CONFIRMED";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] md:w-[85vw] md:max-w-[85vw] lg:w-[75vw] lg:max-w-[75vw] sm:max-w-[95vw] p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-[var(--admin-green-dark)]">
            Chi tiết đơn hàng #{order.id}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden min-h-0">
          {/* ── Left panel ── */}
          <div className="w-full md:w-[340px] shrink-0 border-b md:border-b-0 md:border-r md:overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50">
            {/* Status card */}
            <div className="bg-white rounded-lg shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] p-4 flex flex-col gap-3">
              <p className="text-[13px] text-gray-400">Tình trạng</p>
              <div
                className="flex items-center gap-2 text-sm font-medium"
                style={{ color: statusCfg.color }}
              >
                <StatusIcon className="w-4 h-4 shrink-0" />
                {statusCfg.label}
              </div>
              {payment?.paymentDate && (
                <p className="text-[13px] text-gray-500">
                  Thanh toán lúc: {formatDate(payment.paymentDate)}
                </p>
              )}
              {returnOverlay && (
                <div
                  className={`inline-flex items-center gap-1.5 px-2 py-1 border text-xs font-semibold w-fit ${returnOverlay.className}`}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {returnOverlay.label}
                </div>
              )}
            </div>

            {/* Customer profile card */}
            <UserDetailCard
              user={customerUser}
              hideStatus={true}
            />

            {/* Order info card */}
            <div className="bg-white rounded-lg shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] p-4 flex flex-col gap-3">
              <p className="text-[13px] text-gray-400">Thông tin đơn hàng</p>
              <div className="flex flex-col gap-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span className="text-gray-400">Ngày đặt</span>
                  <span>{formatDate(order.orderDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Thanh toán</span>
                  <span>{payment?.paymentMethod ?? "—"}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-1">
                  <span className="text-gray-400">Tổng tiền</span>
                  <span className="font-bold text-[var(--admin-green-dark)]">
                    {order.totalAmount.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Right panel ── */}
          <div className="flex-1 md:overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 min-w-0">
            {/* Product items */}
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Sản phẩm
              </p>
              {order.orderItems.length === 0 ? (
                <div className="flex items-center gap-3 text-gray-400 text-sm border rounded-lg p-4">
                  <Package className="w-5 h-5" />
                  Không có sản phẩm
                </div>
              ) : (
                order.orderItems.map((item) => {
                  const thumb = item.productVariant?.media?.[0]?.url;
                  return (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 flex gap-4 items-start"
                    >
                      {thumb ? (
                        <div className="w-20 h-20 rounded-lg overflow-hidden border shrink-0">
                          <RowImage src={thumb} alt={item.productVariant.variantName} size={80} />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[var(--admin-green-dark)] text-base">
                          {item.productVariant?.variantName ?? "—"}
                        </p>
                        <p className="font-bold text-gray-800 mt-0.5">
                          {item.unitPrice.toLocaleString("vi-VN")}đ
                        </p>
                        <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-4">
                          <span>Size: {item.productVariant?.variantSize ?? "—"}</span>
                          <span>Màu: {item.productVariant?.variantColor ?? "—"}</span>
                          <span>SL: {item.quantity}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-400 whitespace-nowrap">
                        {item.totalPrice.toLocaleString("vi-VN")}đ
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Return request section ── */}
            {returnRequest && returnBadge && returnBank && (
              <div className="border rounded-lg p-4 flex flex-col gap-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Yêu cầu trả hàng
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 border text-xs font-medium ${returnBadge.className}`}
                  >
                    {returnBadge.label}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex gap-2">
                    <span className="text-gray-400 shrink-0 w-28">Lý do:</span>
                    <span className="font-medium">{returnRequest.description || "—"}</span>
                  </div>
                  {returnBank && (
                    <>
                      <div className="flex gap-2">
                        <span className="text-gray-400 shrink-0 w-28">Ngân hàng:</span>
                        <span>{returnBank.bankName}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 shrink-0 w-28">Số tài khoản:</span>
                        <span>{returnBank.bankAccountNumber}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400 shrink-0 w-28">Chủ tài khoản:</span>
                        <span>{returnBank.bankAccountName}</span>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <span className="text-gray-400 shrink-0 w-28">Ngày gửi:</span>
                    <span>{formatDate(returnRequest.createdAt)}</span>
                  </div>
                  {returnRequest.processByStaff && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 shrink-0 w-28">Xử lý bởi:</span>
                      <span>
                        {returnRequest.processByStaff.firstName ?? ""}{" "}
                        {returnRequest.processByStaff.lastName ?? ""}
                        <span className="text-gray-400"> ({returnRequest.processByStaff.email})</span>
                      </span>
                    </div>
                  )}
                </div>

                {returnMedia.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Ảnh / video minh chứng ({returnMedia.length})
                    </p>
                    <MediaGallery media={returnMedia} columns={5} thumbSize="h-24" />
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 pt-2 border-t">
                    {returnRequest.status === "PENDING" && (
                      <Button
                        onClick={() => handleStartReviewReturn(Number(returnBank!.id))}
                        disabled={submitting}
                        className="bg-[var(--admin-green-mid)] text-[var(--admin-green-dark)] hover:bg-[var(--admin-green-mid)] cursor-pointer"
                      >
                        Bắt đầu xử lý
                      </Button>
                    )}
                    {returnRequest.status === "IN_PROGRESS" && (
                      <>
                        <Button
                          onClick={() => handleApproveReturn(Number(returnBank!.id))}
                          disabled={submitting}
                          className="bg-[var(--admin-green-dark)] text-white hover:bg-[var(--admin-green-dark)] cursor-pointer"
                        >
                          Duyệt (hoàn tiền)
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleRejectReturn(Number(returnBank!.id))}
                          disabled={submitting}
                          className="cursor-pointer"
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                    {(returnRequest.status === "APPROVED" ||
                      returnRequest.status === "REJECTED") && (
                      <p className="text-sm text-gray-500 italic">Đã xử lý xong.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t" />

            {/* ── 2-column layout: left = actions, right = shipping info ── */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">

              {/* ── Left: step actions ── */}
              <div className="flex-1 flex flex-col gap-6">

                {/* Step 1 */}
                <div className="flex flex-col gap-3">
                  <p className={`font-bold text-base ${step1State === "pending" ? "text-gray-300" : "text-black"}`}>
                    Bước 1: Xác nhận đơn hàng
                  </p>

                  {step1State === "pending" && (
                    <p className="text-sm text-gray-300">Chờ thanh toán</p>
                  )}

                  {step1State === "active" && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-gray-600">Chọn ca lấy hàng GHN:</p>
                      {loadingShifts ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Đang tải ca lấy...
                        </div>
                      ) : (
                        <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                          <SelectTrigger className="cursor-pointer">
                            <SelectValue placeholder="Chọn ca lấy hàng" />
                          </SelectTrigger>
                          <SelectContent>
                            {ghnShifts.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)} className="cursor-pointer">
                                {s.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        onClick={handleConfirmOrder}
                        disabled={submitting || loadingShifts || !selectedShiftId}
                        className="w-fit cursor-pointer"
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang xử lý...</>
                        ) : (
                          "Xác nhận & tạo đơn GHN"
                        )}
                      </Button>
                    </div>
                  )}
                  {step1State === "done" && (
                    <p className="text-sm text-gray-400">Đã xác nhận</p>
                  )}
                </div>

                {/* Step 2 */}
                <div className="flex flex-col gap-3">
                  <p className={`font-bold text-base ${step2State === "pending" ? "text-gray-300" : "text-black"}`}>
                    Bước 2: Giao cho đơn vị vận chuyển
                  </p>

                  {step2State === "pending" && (
                    <p className="text-sm text-gray-300">Chờ xác nhận bước 1</p>
                  )}

                  {step2State === "action" && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-gray-600">Đơn hàng đang chờ GHN đến lấy hàng.</p>
                      <Button
                        onClick={handleMarkShipped}
                        disabled={submitting}
                        className="w-fit cursor-pointer"
                      >
                        {submitting ? (
                          <><Loader2 className="w-4 h-4 animate-spin mr-2" />Đang xử lý...</>
                        ) : (
                          "Xác nhận GHN đã lấy hàng"
                        )}
                      </Button>
                    </div>
                  )}
                  {(step2State === "info" || step2State === "done") && (
                    <p className="text-sm text-gray-400">
                      {step2State === "info" ? "Đang vận chuyển" : "GHN đã lấy hàng"}
                    </p>
                  )}
                </div>

                {/* Step 3 */}
                <div className="flex flex-col gap-3">
                  <p className={`font-bold text-base ${step3State === "pending" ? "text-gray-300" : "text-black"}`}>
                    Bước 3: Xác nhận kết quả giao hàng
                  </p>

                  {step3State === "pending" && (
                    <p className="text-sm text-gray-300">Chờ GHN lấy hàng</p>
                  )}

                  {step3State === "active" && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-gray-600">Đơn hàng đang trên đường giao đến khách.</p>
                      <div className="flex gap-3">
                        <Button
                          onClick={handleConfirmDelivered}
                          disabled={submitting}
                          className="cursor-pointer"
                        >
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Giao thành công"}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeliveryFailed}
                          disabled={submitting}
                          className="cursor-pointer"
                        >
                          Giao thất bại
                        </Button>
                      </div>
                    </div>
                  )}
                  {step3State === "done" && (
                    <div className="flex flex-col gap-1">
                      {(order.status === "DELIVERED" || order.status === "COMPLETED") && (
                        <p className="text-sm font-medium text-[var(--admin-status-active)]">Giao hàng thành công</p>
                      )}
                      {shipment?.deliveredAt && (
                        <p className="text-sm text-gray-500">Lúc: {formatDate(shipment.deliveredAt)}</p>
                      )}
                    </div>
                  )}

                  {order.status === "DELIVERED_FAILED" && (
                    <div className="rounded-lg p-3 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)]">
                      <p className="text-sm font-medium text-[var(--status-warning)]">Giao hàng thất bại — chờ xử lý</p>
                    </div>
                  )}
                </div>

                {/* Terminal banners */}
                {(order.status === "CANCELLED" || order.status === "RETURNED") && (
                  <div className={`rounded-lg p-4 border ${
                    order.status === "CANCELLED" ? "bg-[var(--status-error-bg)] border-[var(--status-error-border)]" : "bg-gray-50 border-gray-200"
                  }`}>
                    <p className={`font-bold text-sm ${
                      order.status === "CANCELLED" ? "text-[var(--status-error)]" : "text-gray-600"
                    }`}>
                      {order.status === "CANCELLED" && "Đơn hàng đã bị hủy"}
                      {order.status === "RETURNED" && "Đơn hàng đã được hoàn tiền"}
                    </p>
                  </div>
                )}

                {/* Cancel button */}
                {canCancel && (
                  <div>
                    <Button
                      variant="destructive"
                      onClick={handleCancel}
                      disabled={submitting}
                      className="cursor-pointer"
                    >
                      Hủy đơn hàng
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Right: shipping info card (always visible) ── */}
              <div className="w-72 shrink-0 border rounded-lg bg-gray-50 p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Thông tin vận chuyển</p>
                {shipment ? (
                  <>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="text-gray-400 text-xs">Mã vận đơn</span>
                      <span className="font-mono font-bold text-[var(--admin-green-dark)] break-all">
                        {shipment.ghnOrderCode ?? shipment.trackingNumber ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="text-gray-400 text-xs">Đơn vị vận chuyển</span>
                      <span className="font-bold">{shipment.carrier ?? "—"}</span>
                    </div>
                    {shipment.ghnOrderCode && (
                      <GHNTrackingLink orderId={order.id} accessToken={accessToken} />
                    )}
                    <div className="border-t pt-3 flex flex-col gap-3">
                      {[
                        { label: "Ngày lấy dự kiến", date: shipment.estimatedShipDate },
                        { label: "Đã lấy hàng", date: shipment.shippedAt },
                        { label: "Ngày giao dự kiến", date: shipment.estimatedDelivery },
                        { label: "Đã giao hàng", date: shipment.deliveredAt },
                      ]
                        .filter((e) => e.date)
                        .map((e) => (
                          <div key={e.label} className="flex items-start gap-2 text-sm">
                            <div className="w-2 h-2 rounded-full bg-[var(--admin-green-dark)] mt-1.5 shrink-0" />
                            <div>
                              <p className="text-gray-400 text-xs">{e.label}</p>
                              <p className="text-gray-700">{formatDate(e.date)}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Chưa có thông tin vận chuyển</p>
                )}
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
