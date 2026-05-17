"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Phone, MapPin } from "lucide-react";
import type { UserDto, UserOrderStatsDto } from "@/services/user";
import { userService } from "@/services/user";
import { addressService } from "@/services/address";

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

export function getDisplayName(user: UserDto): string {
  return (
    [user.lastName, user.firstName].filter(Boolean).join(" ") ||
    user.name ||
    user.username ||
    "—"
  );
}

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export interface UserDetailCardProps {
  user: UserDto;
  /** Skip the Phone + Address rows */
  hideContactInfo?: boolean;
  /** Skip the "Tổng quan mua hàng" section */
  hideOrderStats?: boolean;
  /** Skip the "Tình trạng" section */
  hideStatus?: boolean;
}

export function EmptyUserDetailCard() {
  return (
    <div className="bg-white rounded-lg shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] p-5 flex flex-col items-center justify-center gap-3 h-48">
      <p className="text-sm text-gray-400">Chọn một khách hàng để xem chi tiết</p>
    </div>
  );
}

export default function UserDetailCard({ user, hideContactInfo, hideOrderStats, hideStatus }: UserDetailCardProps) {
  const { data: session } = useSession();
  const [addressLine, setAddressLine] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState<UserOrderStatsDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = session?.user?.access_token;
    if (!token || !user.id) return;
    addressService.getUserAddresses(user.id, token).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : [];
      const addr = list.find((a) => a.isDefault) ?? list[0];
      if (addr) {
        setAddressLine(
          [addr.street, addr.ward, addr.district, addr.province].filter(Boolean).join(", ")
        );
      }
    }).catch(() => {});
  }, [user.id, session?.user?.access_token]);

  useEffect(() => {
    const token = session?.user?.access_token;
    if (!token || !user.id || hideOrderStats) return;
    let cancelled = false;
    setStats(null);
    setLoading(true);
    userService
      .getUserOrderStats(user.id, token)
      .then((res) => {
        if (cancelled) return;
        setStats(res.data ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, session?.user?.access_token, hideOrderStats]);

  const name   = getDisplayName(user);
  const status = getStatus(user);
  const cfg    = STATUS_CONFIG[status];

  const orderCount     = stats?.orderCount ?? 0;
  const completedCount = stats?.completedCount ?? 0;
  const cancelledCount = stats?.cancelledCount ?? 0;
  const totalSpend     = stats?.totalSpend ?? 0;

  return (
    <div className="bg-white rounded-lg shadow-[0px_1px_3px_0px_rgba(0,0,0,0.2)] p-5 flex flex-col gap-[10px]">
      <div className="flex items-center gap-3">
        {user.image ? (
          <img src={user.image} alt={name}
            className="w-16 h-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--admin-green-mid)] flex items-center justify-center shrink-0">
            <span className="text-[var(--admin-green-dark)] text-xl font-bold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-bold text-[#023337] leading-[26px]">{name}</p>
          <p className="text-[14px] text-[#6a717f] truncate">{user.email}</p>
        </div>
      </div>

      {!hideContactInfo && (
        <>
          <p className="text-[14px] text-[#9ca3af]">Thông tin khách hàng</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-[4px] px-2 h-10">
              <Phone size={20} className="text-[#6a717f] shrink-0" />
              <span className="text-[14px] text-[#6a717f]">
                {user.phone || "Chưa có số điện thoại"}
              </span>
            </div>
            <div className="flex items-center gap-1 border border-[#e5e7eb] rounded-[4px] px-2 min-h-10 py-2">
              <MapPin size={20} className="text-[#6a717f] shrink-0" />
              <span className="text-[14px] text-[#6a717f] line-clamp-2">
                {addressLine ?? "Chưa có địa chỉ"}
              </span>
            </div>
          </div>
        </>
      )}

      {!hideStatus && (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-[#9ca3af]">Tình trạng</p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
            <span className="text-[14px] font-medium" style={{ color: cfg.textColor }}>
              {cfg.label}
            </span>
          </div>
        </div>
      )}

      {!hideOrderStats && (
        <>
          <p className="text-[14px] text-[#9ca3af]">Tổng quan mua hàng</p>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="flex-1 border border-[#d1d5db] rounded-[4px] flex flex-col items-center justify-center px-2 py-[11px] gap-3 overflow-hidden">
                  <p className="text-[18px] font-bold text-[#023337] w-full text-center">{orderCount}</p>
                  <p className="text-[14px] text-[#6467f2] whitespace-nowrap">Đơn hàng</p>
                </div>
                <div className="flex-1 border border-[#d1d5db] rounded-[4px] flex flex-col items-center justify-center px-2 py-[11px] gap-3 overflow-hidden">
                  <p className="text-[18px] font-bold text-[#023337] w-full text-center">{completedCount}</p>
                  <p className="text-[14px] text-[#21c45d] whitespace-nowrap">Hoàn thành</p>
                </div>
                <div className="flex-1 border border-[#d1d5db] rounded-[4px] flex flex-col items-center justify-center px-2 py-[11px] gap-3 overflow-hidden">
                  <p className="text-[18px] font-bold text-[#023337] w-full text-center">{cancelledCount}</p>
                  <p className="text-[14px] text-[#ef4343] whitespace-nowrap">Hủy</p>
                </div>
              </div>
              {orderCount > 0 && (
                <p className="text-[13px] text-[#6a717f] text-right">
                  Tổng chi:{" "}
                  <span className="font-semibold text-[#023337]">{VND.format(totalSpend)}</span>
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
