"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, Search, Shield, User, UserCog } from "lucide-react";
import { toast } from "sonner";
import { userService, type UserDto, type UserRole } from "@/services/user";
import RoleChangeDialog from "./RoleChangeDialog";

const ROW_HEIGHT = 72;
const PER_PAGE = 20;

type RoleTab = "ALL" | UserRole;

const ROLE_META: Record<
  UserRole,
  { label: string; dot: string; text: string; Icon: React.ElementType }
> = {
  USER:     { label: "Khách hàng", dot: "bg-[#21c45d]", text: "text-[#21c45d]", Icon: User },
  OPERATOR: { label: "Nhân viên",  dot: "bg-[#f59e0b]", text: "text-[#f59e0b]", Icon: UserCog },
  ADMIN:    { label: "Admin",      dot: "bg-[#ef4444]", text: "text-[#ef4444]", Icon: Shield },
};

const ROLE_ORDER: UserRole[] = ["USER", "OPERATOR", "ADMIN"];

function getDisplayName(user: UserDto): string {
  return (
    [user.lastName, user.firstName].filter(Boolean).join(" ") ||
    user.name ||
    user.username ||
    "—"
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

export default function AuthorityClient() {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";
  const myId = session?.user?.id;

  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState<RoleTab>("ALL");

  const [pendingChange, setPendingChange] = useState<{
    user: UserDto;
    nextRole: UserRole;
  } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setUsers([]);
      let page = 1;
      const all: UserDto[] = [];
      try {
        while (!cancelled) {
          console.log("[AdminAuthority] Fetching page:", page);
          const res = await userService.getUsers(page, PER_PAGE, accessToken);
          const data = Array.isArray(res?.data) ? res.data : [];
          console.log("[AdminAuthority] Page", page, "→ got", data.length, "items");
          if (data.length === 0) break;
          all.push(...data);
          if (cancelled) return;
          // First page → swap from spinner to streaming list
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
        if (!cancelled) {
          console.log("[AdminAuthority] Done. Total users:", all.length);
        }
      } catch (err) {
        console.error("[AdminAuthority] Fetch error:", err);
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

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setAppliedSearch(value), 300);
  };

  const counts = useMemo(() => {
    const c = { ALL: users.length, ADMIN: 0, OPERATOR: 0, USER: 0 };
    for (const u of users) {
      const r = (u.role ?? "USER") as UserRole;
      c[r] += 1;
    }
    return c;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return users.filter((u) => {
      const role = (u.role ?? "USER") as UserRole;
      if (activeTab !== "ALL" && role !== activeTab) return false;
      if (!q) return true;
      return (
        `#${String(u.id).padStart(4, "0")}`.includes(q) ||
        getDisplayName(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").includes(q)
      );
    });
  }, [users, appliedSearch, activeTab]);

  const rowVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const requestRoleChange = (user: UserDto, nextRole: UserRole) => {
    if (savingId !== null) return;
    if (myId !== undefined && String(user.id) === String(myId)) {
      toast.error("Không thể đổi vai trò của chính mình");
      return;
    }
    if ((user.role ?? "USER") === nextRole) return;
    setPendingChange({ user, nextRole });
  };

  const confirmRoleChange = async () => {
    if (!pendingChange || !accessToken) return;
    const { user, nextRole } = pendingChange;
    setSavingId(user.id);
    try {
      console.log("[AdminAuthority] PATCH /user/" + user.id + " role:", nextRole);
      const res = await userService.updateUser(
        String(user.id),
        { role: nextRole },
        accessToken
      );
      console.log("[AdminAuthority] Update response:", res);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u))
      );
      toast.success(
        `Đã đổi vai trò của ${getDisplayName(user)} thành ${ROLE_META[nextRole].label}`
      );
      setPendingChange(null);
    } catch (err) {
      console.error("[AdminAuthority] Update error:", err);
      toast.error("Cập nhật vai trò thất bại. Vui lòng thử lại.");
    } finally {
      setSavingId(null);
    }
  };

  const tabs: { key: RoleTab; label: string; count: number }[] = [
    { key: "ALL",      label: "Tất cả tài khoản", count: counts.ALL },
    { key: "ADMIN",    label: "Admin",            count: counts.ADMIN },
    { key: "OPERATOR", label: "Nhân viên",        count: counts.OPERATOR },
    { key: "USER",     label: "Khách hàng",       count: counts.USER },
  ];

  return (
    <div className="p-3 sm:p-4 md:p-6 flex flex-col gap-4 md:gap-5 h-full min-h-0">
      <div>
        <h1 className="text-xl font-bold text-[#023337]">Cài đặt quyền</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Quản lý vai trò của tài khoản trong hệ thống
        </p>
      </div>

      <div className="bg-white shadow rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="px-3 sm:px-6 pt-5 pb-4 flex flex-col gap-4 shrink-0 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#023337]">Các tài khoản</h2>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-gray-50 rounded-md p-1 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-4 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
                      active
                        ? "bg-[var(--admin-green-mid)] text-[var(--admin-green-dark)] font-semibold"
                        : "text-gray-600 hover:text-[#023337]"
                    }`}
                  >
                    {t.label}
                    {t.key === "ALL" && (
                      <span className="ml-1 text-xs text-gray-500">({t.count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-auto">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm theo ID, tên, email, SĐT..."
                className="w-full sm:w-[280px] pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--admin-green-mid)] placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
          <div className="min-w-[900px] flex flex-col flex-1 min-h-0">
        <div className="bg-[var(--admin-green-light)] grid grid-cols-[80px_1.2fr_1.6fr_1fr_110px_1.8fr] items-center px-6 h-[44px] shrink-0">
          {(["ID", "Tên", "Email", "Số điện thoại", "Ngày tạo", "Vai trò"] as const).map(
            (col) => (
              <div key={col} className="text-[14px] font-medium text-[#023337]">
                {col}
              </div>
            )
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div ref={tableContainerRef} className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                Không tìm thấy tài khoản
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const user = filteredUsers[vRow.index];
                  const role = (user.role ?? "USER") as UserRole;
                  const meta = ROLE_META[role];
                  const isSelf =
                    myId !== undefined && String(user.id) === String(myId);
                  const isSaving = savingId === user.id;

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
                      className="grid grid-cols-[80px_1.2fr_1.6fr_1fr_110px_1.8fr] items-center px-6 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-[15px] text-black">
                        #{String(user.id).padStart(4, "0")}
                      </div>
                      <div className="text-[15px] text-black truncate pr-3">
                        {getDisplayName(user)}
                      </div>
                      <div className="text-[14px] text-gray-600 truncate pr-3">
                        {user.email || <span className="text-gray-300">—</span>}
                      </div>
                      <div className="text-[14px] text-gray-600 truncate pr-3">
                        {user.phone || <span className="text-gray-300">—</span>}
                      </div>
                      <div className="text-[15px] text-black">
                        {formatDate(user.createdAt)}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                          />
                          <span
                            className={`text-[14px] font-medium ${meta.text}`}
                          >
                            {meta.label}
                          </span>
                          {isSaving && (
                            <Loader2
                              size={14}
                              className="animate-spin text-gray-400"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {ROLE_ORDER.map((r) => {
                            const m = ROLE_META[r];
                            const Icon = m.Icon;
                            const active = r === role;
                            const disabled = isSelf || isSaving;
                            return (
                              <button
                                key={r}
                                type="button"
                                disabled={disabled}
                                onClick={() => requestRoleChange(user, r)}
                                title={
                                  isSelf
                                    ? "Không thể đổi vai trò của chính mình"
                                    : `Đổi sang ${m.label}`
                                }
                                className={`w-7 h-7 flex items-center justify-center rounded-full border transition-colors ${
                                  active
                                    ? `border-current ${m.text}`
                                    : "border-gray-200 text-gray-400"
                                } ${
                                  disabled
                                    ? "opacity-60 cursor-not-allowed"
                                    : "cursor-pointer hover:border-current hover:text-[#023337]"
                                }`}
                              >
                                <Icon size={14} />
                              </button>
                            );
                          })}
                        </div>
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

      <RoleChangeDialog
        open={pendingChange !== null}
        userName={pendingChange ? getDisplayName(pendingChange.user) : ""}
        currentRole={
          pendingChange
            ? ROLE_META[(pendingChange.user.role ?? "USER") as UserRole].label
            : ""
        }
        nextRole={
          pendingChange ? ROLE_META[pendingChange.nextRole].label : ""
        }
        saving={savingId !== null}
        onCancel={() => setPendingChange(null)}
        onConfirm={confirmRoleChange}
      />
    </div>
  );
}
