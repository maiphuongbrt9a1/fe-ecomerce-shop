"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PrimaryDashboardChartDto } from "@/dto/analytics";

interface PrimaryChartsProps {
  data: PrimaryDashboardChartDto | null;
  isLoading?: boolean;
}

type ChartTab = "revenue" | "orders" | "customers" | "variants";

const formatVND = (v: number) =>
  new Intl.NumberFormat("vi-VN", { notation: "compact", compactDisplay: "short" }).format(v);

export default function PrimaryCharts({ data, isLoading }: PrimaryChartsProps) {
  const [tab, setTab] = useState<ChartTab>("revenue");

  const currentData = data?.currentReportData.chartData;
  const previousData = data?.previousReportData.chartData;

  const chartData = (() => {
    if (!currentData) return [];
    if (tab === "revenue") {
      return currentData.revenue.map((item, i) => ({
        date: item.date,
        "Kỳ hiện tại": item.revenue,
        "Kỳ trước": previousData?.revenue[i]?.revenue ?? 0,
      }));
    }
    if (tab === "orders") {
      return currentData.revenue.map((item, i) => ({
        date: item.date,
        "Kỳ hiện tại": item.orderCount,
        "Kỳ trước": previousData?.revenue[i]?.orderCount ?? 0,
      }));
    }
    if (tab === "customers") {
      return currentData.customer.map((item, i) => ({
        date: item.date,
        "Kỳ hiện tại": item.totalCustomers,
        "Kỳ trước": previousData?.customer[i]?.totalCustomers ?? 0,
      }));
    }
    return currentData.soldProductVariant.map((item, i) => ({
      date: item.date,
      "Kỳ hiện tại": item.totalSoldProductVariants,
      "Kỳ trước": previousData?.soldProductVariant[i]?.totalSoldProductVariants ?? 0,
    }));
  })();

  const yFormatter = tab === "revenue" ? formatVND : (v: number) => v.toString();

  const titles: Record<ChartTab, string> = {
    revenue: "Doanh thu",
    orders: "Đơn hàng",
    customers: "Khách hàng",
    variants: "Sản phẩm bán ra",
  };

  return (
    <Card className="bg-white rounded-lg shadow-[var(--admin-card-shadow)]">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-gray-700">
          Biểu đồ theo kỳ — {titles[tab]}
        </CardTitle>
        <Tabs value={tab} onValueChange={(v) => setTab(v as ChartTab)}>
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="h-8 w-max">
              <TabsTrigger value="revenue" className="text-xs px-2">Doanh thu</TabsTrigger>
              <TabsTrigger value="orders" className="text-xs px-2">Đơn hàng</TabsTrigger>
              <TabsTrigger value="customers" className="text-xs px-2">Khách hàng</TabsTrigger>
              <TabsTrigger value="variants" className="text-xs px-2">Sản phẩm</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="h-64 flex items-center justify-center">
            <div className="h-48 w-full animate-pulse bg-gray-100 rounded" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={yFormatter} width={60} />
              <Tooltip
                formatter={(value) => {
                  const v = Number(value);
                  return tab === "revenue"
                    ? [new Intl.NumberFormat("vi-VN").format(v) + " ₫", ""]
                    : [v, ""];
                }}
                labelStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Kỳ hiện tại"
                stroke="var(--admin-green-dark)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Kỳ trước"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
