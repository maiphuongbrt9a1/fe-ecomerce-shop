"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown } from "lucide-react";
import { theme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { categoryService } from "@/services/category";
import type { CategoryDto } from "@/dto/category";
import { useNotifications } from "@/components/notification/NotificationContext";
import { extractOrderId } from "@/utils/notification-route";
import { useCart } from "@/components/cart/CartContext";
import { getNotificationRoute } from "@/utils/notification-route";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const { notifications, unreadCount, markRead, orderImageMap } = useNotifications();
  const { cartCount } = useCart();
  const previewNotifications = notifications.slice(0, 5);

  useEffect(() => {
    categoryService.getAllCategories().then((res) => {
      if (Array.isArray(res?.data)) setCategories(res.data);
    }).catch(() => {});
  }, []);

  // Handle scroll to show/hide header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const onSearch = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = ((new FormData(e.currentTarget)).get("q") as string ?? "").trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }, [router]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 w-full text-white shadow-lg z-50 transition-all duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
      style={{
        background: theme.gradient.header,
        boxShadow: theme.shadow.lg,
      }}
    >
      {/* Top utility bar */}
      <div className="mx-auto max-w-7xl px-3 md:px-6">
        <div className="flex items-center justify-end gap-5 py-2 text-xs text-white/70">
          <span className="hidden sm:inline-flex items-center gap-2"><i className="fa-regular fa-circle-question" aria-hidden /> Hỗ trợ</span>
          {session ? (
            <>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:inline-flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer relative">
                    <span className="relative">
                      <i className="fa-regular fa-bell" aria-hidden />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 rounded-full">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </span>
                    Thông báo
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-0">
                  <div className="px-4 py-3 border-b font-semibold text-sm">Thông báo</div>
                  {previewNotifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-500">Chưa có thông báo nào</div>
                  ) : (
                    <div>
                      {previewNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors ${
                            !n.isRead && n.type === "PERSONAL_NOTIFICATION"
                              ? "bg-blue-50 hover:bg-blue-100"
                              : "hover:bg-gray-50"
                          } ${getNotificationRoute(n) ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (n.type === "PERSONAL_NOTIFICATION" && !n.isRead) markRead(n.id);
                            const route = getNotificationRoute(n);
                            if (route) router.push(route);
                          }}
                        >
                          {(() => {
                            const orderId = n.type === "PERSONAL_NOTIFICATION" ? extractOrderId(n.content) : null;
                            const imgUrl = orderId ? orderImageMap[orderId] : null;
                            return (
                              <div
                                className={`w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full text-xs overflow-hidden ${
                                  imgUrl ? "" : n.type === "PERSONAL_NOTIFICATION" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                }`}
                              >
                                {imgUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <i className={`fa-solid ${n.type === "PERSONAL_NOTIFICATION" ? "fa-box" : "fa-tag"}`} />
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-snug mb-0.5 line-clamp-1 ${!n.isRead && n.type === "PERSONAL_NOTIFICATION" ? "font-bold" : "font-medium"}`}>
                              {n.title}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-2">{n.content}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{dayjs(n.createdAt).fromNow()}</p>
                          </div>
                          {!n.isRead && n.type === "PERSONAL_NOTIFICATION" && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t">
                    <Link
                      href="/profile/notifications"
                      className="block w-full text-center text-xs font-medium text-blue-600 py-3 hover:bg-gray-50 transition-colors"
                    >
                      Xem tất cả thông báo
                    </Link>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="hidden md:inline-flex items-center gap-2"><i className="fa-solid fa-globe" aria-hidden /> Tiếng Việt</span>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
                    <i className="fa-regular fa-user" aria-hidden /> Tài khoản
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile">Thông tin cá nhân</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile/notifications">Thông báo</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile/orders">Đơn hàng</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href="/profile/vouchers">Voucher</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                    className="cursor-pointer font-medium"
                  >
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <span className="hidden md:inline-flex items-center gap-2"><i className="fa-solid fa-globe" aria-hidden /> Tiếng Việt</span>
              <Link href="/auth/login" className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                Đăng nhập
              </Link>
              <span className="text-white/40">|</span>
              <Link href="/auth/signup" className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main nav bar */}
      <div className="mx-auto max-w-7xl px-3 md:px-6 py-3">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Logo */}
          <Link href="/homepage" className="flex items-center shrink-0" aria-label="Trang chủ">
            <Image
              src="/LOGO-dark.svg"
              alt="Logo"
              width={110}
              height={32}
              priority
            />
          </Link>

          {/* Primary nav */}
          <nav className="hidden lg:flex items-center gap-1">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 text-sm md:text-base font-semibold text-white/90 hover:text-white transition-colors cursor-pointer select-none">
                  Danh mục <ChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40 max-h-80 overflow-y-auto">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/search">Tất cả sản phẩm</Link>
                </DropdownMenuItem>
                {categories.length > 0 && <DropdownMenuSeparator />}
                {categories.map((cat) => (
                  <DropdownMenuItem key={cat.id} asChild className="cursor-pointer">
                    <Link href={`/search?categoryId=${cat.id}`}>{cat.name}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Search + cart */}
          <div className="ml-auto flex items-center gap-3 md:gap-4">
            <form onSubmit={onSearch} className="hidden md:flex items-stretch border border-white/20">
              <input
                name="q"
                placeholder="Tìm kiếm sản phẩm"
                className="w-56 lg:w-72 px-3 py-2 text-sm focus:outline-none bg-white/10 text-white placeholder:text-white/50"
                autoComplete="off"
              />
              <button type="submit" className="px-4 transition-opacity hover:opacity-80 text-black bg-white cursor-pointer" aria-label="Tìm kiếm">
                <i className="fa-solid fa-magnifying-glass" />
              </button>
            </form>

            <Link href="/product/1" className="hidden" aria-hidden>
              {/* hidden placeholder to keep focus order deterministic */}
            </Link>
            <Link href={session ? "/cart" : "/auth/login?callbackUrl=%2Fcart"} title="Giỏ hàng" className="relative p-2 transition-opacity hover:opacity-80 cursor-pointer">
              <i className="fa-solid fa-cart-shopping" />
              {session && cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-0.5 rounded-full">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Secondary nav for mobile */}
        {categories.length > 0 && (
          <nav className="mt-3 flex flex-wrap gap-1 lg:hidden">
            <Link
              href="/search"
              className="px-3 py-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors cursor-pointer"
            >
              Tất cả
            </Link>
            {categories.slice(0, 5).map((cat) => (
              <Link
                key={cat.id}
                href={`/search?categoryId=${cat.id}`}
                className="px-3 py-1.5 text-sm font-semibold text-white/90 hover:text-white transition-colors cursor-pointer"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
