"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarItem = {
    id: string;
    label: string;
    icon: string;
    href: string;
};

const items: SidebarItem[] = [
    { id: "account", label: "Tài khoản của tôi", icon: "fa-user", href: "/profile" },
    { id: "notifications", label: "Thông báo", icon: "fa-bell", href: "/profile/notifications" },
    { id: "orders", label: "Đơn hàng", icon: "fa-receipt", href: "/profile/orders" },
    { id: "vouchers", label: "Voucher của bạn", icon: "fa-ticket", href: "/profile/vouchers" },
];

export default function ProfileSidebar() {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile: horizontal scrollable pill bar */}
            <nav
                className="md:hidden -mx-3 sm:-mx-6 px-3 sm:px-6 pt-2 pb-3 overflow-x-auto border-b border-gray-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Chuyển mục hồ sơ"
            >
                <ul className="flex items-center gap-2 w-max">
                    {items.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.id}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border transition-colors ${
                                        isActive
                                            ? "bg-black text-white border-black font-semibold"
                                            : "bg-white text-gray-700 border-gray-300 hover:border-black"
                                    }`}
                                >
                                    <i className={`fa ${item.icon}`} aria-hidden />
                                    <span>{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Desktop: vertical sidebar */}
            <aside className="hidden md:block w-64 shrink-0 min-h-[calc(100vh-80px)]">
                <nav className="py-6">
                    {items.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`flex items-center gap-3 py-3 text-sm transition-all ${
                                    isActive
                                        ? "font-bold text-black translate-x-2"
                                        : "text-gray-700 hover:text-black"
                                }`}
                            >
                                <i className={`fa ${item.icon} w-5`} aria-hidden />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
