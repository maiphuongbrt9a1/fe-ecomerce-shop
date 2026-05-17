import React from "react";
import StaffSidebar from "./sidebar";
import AdminBodyTheme from "@/app/admin/AdminBodyTheme";
import { auth } from "@/auth";
import "@/styles/theme-admin.css";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isOperator = session?.user?.role === "OPERATOR";
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.isAdmin === true;

  if (!isOperator && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-800">
        Unauthorized
      </div>
    );
  }

  return (
    <div className="admin-theme h-screen flex flex-col lg:flex-row bg-gray-50 overflow-hidden">
      <AdminBodyTheme />
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
    </div>
  );
}
