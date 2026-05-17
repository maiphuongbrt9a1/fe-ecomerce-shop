"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  CheckCircle,
  XCircle,
  RotateCcw,
  Truck,
  TruckIcon,
  AlertCircle,
  CircleCheckBig,
  CreditCard,
  Clock,
  Ban,
  RefreshCcw,
  DollarSign,
  Package,
  PackageX,
  Users,
  UserPlus,
  UserCheck,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyticsService } from "@/services/analytics";
import type {
  AnalyticsDashboardCardNumberMetricDto,
  AnalyticsDashboardCardRevenueMetricDto,
  AnalyticsViewMode,
  DashboardCardQueryParams,
  PrimaryDashboardChartDto,
  SecondaryDashboardChartDto,
} from "@/dto/analytics";
import MetricCard from "./MetricCard";
import StaticMetricCard from "./StaticMetricCard";
import PrimaryCharts from "./PrimaryCharts";
import CustomerStackedChart from "./CustomerStackedChart";
import RetentionRateChart from "./RetentionRateChart";
import TopSellingProductsTable from "./TopSellingProductsTable";
import TopRevenueUsersTable from "./TopRevenueUsersTable";

interface DashboardClientProps {
  token: string;
}

interface AllMetrics {
  revenue: AnalyticsDashboardCardRevenueMetricDto | null;
  totalOrders: AnalyticsDashboardCardNumberMetricDto | null;
  confirmedOrders: AnalyticsDashboardCardNumberMetricDto | null;
  cancelledOrders: AnalyticsDashboardCardNumberMetricDto | null;
  returnedOrders: AnalyticsDashboardCardNumberMetricDto | null;
  deliveredOrders: AnalyticsDashboardCardNumberMetricDto | null;
  deliveryFailedOrders: AnalyticsDashboardCardNumberMetricDto | null;
  completedOrders: AnalyticsDashboardCardNumberMetricDto | null;
  paidPayments: AnalyticsDashboardCardNumberMetricDto | null;
  pendingPayments: AnalyticsDashboardCardNumberMetricDto | null;
  failedPayments: AnalyticsDashboardCardNumberMetricDto | null;
  refundedPayments: AnalyticsDashboardCardNumberMetricDto | null;
  cancelledPayments: AnalyticsDashboardCardNumberMetricDto | null;
  totalCustomers: AnalyticsDashboardCardNumberMetricDto | null;
  newCustomers: AnalyticsDashboardCardNumberMetricDto | null;
  returningCustomers: AnalyticsDashboardCardNumberMetricDto | null;
  retentionRate: AnalyticsDashboardCardNumberMetricDto | null;
  inStock: number | null;
  outOfStock: number | null;
}

const formatVND = (v: number) =>
  new Intl.NumberFormat("vi-VN", { notation: "compact", compactDisplay: "short" }).format(v) + " ₫";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

export default function DashboardClient({ token }: DashboardClientProps) {
  const [viewMode, setViewMode] = useState<AnalyticsViewMode>("WEEKLY");
  const [referenceDate, setReferenceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<AllMetrics>({
    revenue: null,
    totalOrders: null,
    confirmedOrders: null,
    cancelledOrders: null,
    returnedOrders: null,
    deliveredOrders: null,
    deliveryFailedOrders: null,
    completedOrders: null,
    paidPayments: null,
    pendingPayments: null,
    failedPayments: null,
    refundedPayments: null,
    cancelledPayments: null,
    totalCustomers: null,
    newCustomers: null,
    returningCustomers: null,
    retentionRate: null,
    inStock: null,
    outOfStock: null,
  });
  const [primaryChart, setPrimaryChart] = useState<PrimaryDashboardChartDto | null>(null);
  const [secondaryChart, setSecondaryChart] = useState<SecondaryDashboardChartDto | null>(null);

  const fetchAll = useCallback(async () => {
    const params: DashboardCardQueryParams = { viewMode, referenceDate };
    setIsLoading(true);
    try {
      const [
        revenue,
        totalOrders,
        confirmedOrders,
        cancelledOrders,
        returnedOrders,
        deliveredOrders,
        deliveryFailedOrders,
        completedOrders,
        paidPayments,
        pendingPayments,
        failedPayments,
        refundedPayments,
        cancelledPayments,
        totalCustomers,
        newCustomers,
        returningCustomers,
        retentionRate,
        inStockRes,
        outOfStockRes,
        primaryRes,
        secondaryRes,
      ] = await Promise.allSettled([
        analyticsService.getTotalRevenue(token, params),
        analyticsService.getTotalOrders(token, params),
        analyticsService.getTotalPaymentConfirmedOrders(token, params),
        analyticsService.getTotalCancelledOrders(token, params),
        analyticsService.getTotalReturnedOrders(token, params),
        analyticsService.getTotalDeliveredOrders(token, params),
        analyticsService.getTotalDeliveryFailedOrders(token, params),
        analyticsService.getTotalCompletedOrders(token, params),
        analyticsService.getTotalPaidPayments(token, params),
        analyticsService.getTotalPendingPayments(token, params),
        analyticsService.getTotalFailedPayments(token, params),
        analyticsService.getTotalRefundedPayments(token, params),
        analyticsService.getTotalCancelledPayments(token, params),
        analyticsService.getTotalCustomers(token, params),
        analyticsService.getTotalNewCustomers(token, params),
        analyticsService.getTotalReturningCustomers(token, params),
        analyticsService.getCustomerRetentionRate(token, params),
        analyticsService.getTotalInStock(token),
        analyticsService.getTotalOutOfStock(token),
        analyticsService.getPrimaryDashboardChart(token, params),
        analyticsService.getSecondaryDashboardChart(token, params),
      ]);

      setMetrics({
        revenue: revenue.status === "fulfilled" ? (revenue.value.data ?? null) : null,
        totalOrders: totalOrders.status === "fulfilled" ? (totalOrders.value.data ?? null) : null,
        confirmedOrders: confirmedOrders.status === "fulfilled" ? (confirmedOrders.value.data ?? null) : null,
        cancelledOrders: cancelledOrders.status === "fulfilled" ? (cancelledOrders.value.data ?? null) : null,
        returnedOrders: returnedOrders.status === "fulfilled" ? (returnedOrders.value.data ?? null) : null,
        deliveredOrders: deliveredOrders.status === "fulfilled" ? (deliveredOrders.value.data ?? null) : null,
        deliveryFailedOrders: deliveryFailedOrders.status === "fulfilled" ? (deliveryFailedOrders.value.data ?? null) : null,
        completedOrders: completedOrders.status === "fulfilled" ? (completedOrders.value.data ?? null) : null,
        paidPayments: paidPayments.status === "fulfilled" ? (paidPayments.value.data ?? null) : null,
        pendingPayments: pendingPayments.status === "fulfilled" ? (pendingPayments.value.data ?? null) : null,
        failedPayments: failedPayments.status === "fulfilled" ? (failedPayments.value.data ?? null) : null,
        refundedPayments: refundedPayments.status === "fulfilled" ? (refundedPayments.value.data ?? null) : null,
        cancelledPayments: cancelledPayments.status === "fulfilled" ? (cancelledPayments.value.data ?? null) : null,
        totalCustomers: totalCustomers.status === "fulfilled" ? (totalCustomers.value.data ?? null) : null,
        newCustomers: newCustomers.status === "fulfilled" ? (newCustomers.value.data ?? null) : null,
        returningCustomers: returningCustomers.status === "fulfilled" ? (returningCustomers.value.data ?? null) : null,
        retentionRate: retentionRate.status === "fulfilled" ? (retentionRate.value.data ?? null) : null,
        inStock: inStockRes.status === "fulfilled" ? (inStockRes.value.data?.totalInStock ?? null) : null,
        outOfStock: outOfStockRes.status === "fulfilled" ? (outOfStockRes.value.data?.totalOutOfStock ?? null) : null,
      });
      if (primaryRes.status === "fulfilled") setPrimaryChart(primaryRes.value.data ?? null);
      if (secondaryRes.status === "fulfilled") setSecondaryChart(secondaryRes.value.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [token, viewMode, referenceDate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const num = (m: AnalyticsDashboardCardNumberMetricDto | null) => m?.currentPeriod ?? 0;
  const pct = (m: AnalyticsDashboardCardNumberMetricDto | null) => m?.percentageChange ?? 0;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tổng quan</h1>
          <p className="text-xs text-gray-400 mt-0.5">Dữ liệu phân tích theo kỳ</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as AnalyticsViewMode)}>
            <SelectTrigger className="w-32 h-8 text-xs cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEEKLY" className="text-xs cursor-pointer">Theo tuần</SelectItem>
              <SelectItem value="MONTHLY" className="text-xs cursor-pointer">Theo tháng</SelectItem>
              <SelectItem value="YEARLY" className="text-xs cursor-pointer">Theo năm</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            className="h-8 px-2 text-xs border border-gray-200 rounded-md bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
      </div>

      {/* Section: Doanh thu & Đơn hàng */}
      <section>
        <SectionHeading>Doanh thu &amp; Đơn hàng</SectionHeading>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard
            title="Tổng doanh thu"
            value={metrics.revenue?.currentPeriod._sum.totalAmount ?? 0}
            percentageChange={metrics.revenue?.percentageChange ?? 0}
            icon={TrendingUp}
            formatter={formatVND}
            isLoading={isLoading}
          />
          <MetricCard
            title="Tổng đơn hàng"
            value={num(metrics.totalOrders)}
            percentageChange={pct(metrics.totalOrders)}
            icon={ShoppingCart}
            isLoading={isLoading}
          />
          <MetricCard
            title="Đã xác nhận TT"
            value={num(metrics.confirmedOrders)}
            percentageChange={pct(metrics.confirmedOrders)}
            icon={CheckCircle}
            isLoading={isLoading}
          />
          <MetricCard
            title="Đã hủy"
            value={num(metrics.cancelledOrders)}
            percentageChange={pct(metrics.cancelledOrders)}
            icon={XCircle}
            isLoading={isLoading}
          />
          <MetricCard
            title="Đã hoàn trả"
            value={num(metrics.returnedOrders)}
            percentageChange={pct(metrics.returnedOrders)}
            icon={RotateCcw}
            isLoading={isLoading}
          />
          <MetricCard
            title="Đã giao hàng"
            value={num(metrics.deliveredOrders)}
            percentageChange={pct(metrics.deliveredOrders)}
            icon={Truck}
            isLoading={isLoading}
          />
          <MetricCard
            title="Giao hàng thất bại"
            value={num(metrics.deliveryFailedOrders)}
            percentageChange={pct(metrics.deliveryFailedOrders)}
            icon={TruckIcon}
            isLoading={isLoading}
          />
          <MetricCard
            title="Hoàn thành"
            value={num(metrics.completedOrders)}
            percentageChange={pct(metrics.completedOrders)}
            icon={CircleCheckBig}
            isLoading={isLoading}
          />
        </div>
      </section>

      {/* Section: Primary chart */}
      <section>
        <SectionHeading>Biểu đồ theo kỳ</SectionHeading>
        <PrimaryCharts data={primaryChart} isLoading={isLoading} />
      </section>

      {/* Section: Thanh toán */}
      <section>
        <SectionHeading>Thanh toán</SectionHeading>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            title="Đã thanh toán"
            value={num(metrics.paidPayments)}
            percentageChange={pct(metrics.paidPayments)}
            icon={CreditCard}
            isLoading={isLoading}
          />
          <MetricCard
            title="Đang chờ"
            value={num(metrics.pendingPayments)}
            percentageChange={pct(metrics.pendingPayments)}
            icon={Clock}
            isLoading={isLoading}
          />
          <MetricCard
            title="Thất bại"
            value={num(metrics.failedPayments)}
            percentageChange={pct(metrics.failedPayments)}
            icon={AlertCircle}
            isLoading={isLoading}
          />
          <MetricCard
            title="Đã hoàn tiền"
            value={num(metrics.refundedPayments)}
            percentageChange={pct(metrics.refundedPayments)}
            icon={RefreshCcw}
            isLoading={isLoading}
          />
          <MetricCard
            title="TT đã hủy"
            value={num(metrics.cancelledPayments)}
            percentageChange={pct(metrics.cancelledPayments)}
            icon={Ban}
            isLoading={isLoading}
          />
        </div>
      </section>

      {/* Section: Kho hàng */}
      <section>
        <SectionHeading>Kho hàng</SectionHeading>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StaticMetricCard
            title="Còn hàng"
            value={metrics.inStock ?? 0}
            icon={Package}
            description="Tổng số lượng biến thể còn hàng"
            isLoading={isLoading}
          />
          <StaticMetricCard
            title="Hết hàng"
            value={metrics.outOfStock ?? 0}
            icon={PackageX}
            description="Tổng số lượng biến thể hết hàng"
            isLoading={isLoading}
          />
        </div>
      </section>

      {/* Section: Khách hàng */}
      <section>
        <SectionHeading>Khách hàng</SectionHeading>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard
            title="Tổng khách hàng"
            value={num(metrics.totalCustomers)}
            percentageChange={pct(metrics.totalCustomers)}
            icon={Users}
            isLoading={isLoading}
          />
          <MetricCard
            title="Khách mới"
            value={num(metrics.newCustomers)}
            percentageChange={pct(metrics.newCustomers)}
            icon={UserPlus}
            isLoading={isLoading}
          />
          <MetricCard
            title="Khách quay lại"
            value={num(metrics.returningCustomers)}
            percentageChange={pct(metrics.returningCustomers)}
            icon={UserCheck}
            isLoading={isLoading}
          />
          <MetricCard
            title="Tỷ lệ giữ chân (%)"
            value={num(metrics.retentionRate)}
            percentageChange={pct(metrics.retentionRate)}
            icon={BarChart3}
            formatter={(v) => `${v.toFixed(1)}%`}
            isLoading={isLoading}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CustomerStackedChart
            data={secondaryChart?.currentCustomerReportData.customerChartDataForStackedColumnChart ?? []}
            isLoading={isLoading}
          />
          <RetentionRateChart
            data={secondaryChart?.customerRetentionRateTimeSeries ?? []}
            isLoading={isLoading}
          />
        </div>
      </section>

      {/* Section: Bảng xếp hạng */}
      <section>
        <SectionHeading>Bảng xếp hạng</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TopSellingProductsTable token={token} />
          <TopRevenueUsersTable token={token} type="users" />
          <TopRevenueUsersTable token={token} type="staffs" />
        </div>
      </section>
    </div>
  );
}
