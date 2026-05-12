import { sendRequest } from "@/utils/api";
import type {
  AnalyticsDashboardCardNumberMetricDto,
  AnalyticsDashboardCardRevenueMetricDto,
  AnalyticsTopRevenueUserDto,
  AnalyticsTopSellingVariantDto,
  DashboardCardQueryParams,
  PrimaryDashboardChartDto,
  SecondaryDashboardChartDto,
} from "@/dto/analytics";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const ANALYTICS = `${BASE_URL}/analytics`;

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function cardParams(params?: DashboardCardQueryParams) {
  const q: Record<string, string> = {};
  if (params?.viewMode) q.viewMode = params.viewMode;
  if (params?.referenceDate) q.referenceDate = params.referenceDate;
  return q;
}

export const analyticsService = {
  // --- Revenue ---
  getTotalRevenue(token: string, params?: DashboardCardQueryParams) {
    // console.log("[analyticsService] getTotalRevenue Request:", params);
    return sendRequest<IBackendRes<AnalyticsDashboardCardRevenueMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-revenue`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },

  // --- Order counts ---
  getTotalOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalPaymentConfirmedOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-payment-confirmed-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalCancelledOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-cancelled-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalReturnedOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-returned-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalDeliveredOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-delivered-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalDeliveryFailedOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-delivery-failed-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalCompletedOrders(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-completed-orders`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },

  // --- Payment counts ---
  getTotalPaidPayments(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-paid-payments`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalPendingPayments(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-pending-payments`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalFailedPayments(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-failed-payments`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalRefundedPayments(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-refunded-payments`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalCancelledPayments(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-cancelled-payments`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },

  // --- Customer counts ---
  getTotalCustomers(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-customers`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalNewCustomers(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-new-customers`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getTotalReturningCustomers(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/total-returning-customers`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getCustomerRetentionRate(token: string, params?: DashboardCardQueryParams) {
    return sendRequest<IBackendRes<AnalyticsDashboardCardNumberMetricDto>>({
      url: `${ANALYTICS}/dashboard-card/customer-retention-rate`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },

  // --- Inventory (no period) ---
  getTotalInStock(token: string) {
    return sendRequest<IBackendRes<{ totalInStock: number }>>({
      url: `${ANALYTICS}/dashboard-card/total-in-stock-product-variants`,
      method: "GET",
      headers: authHeaders(token),
    });
  },
  getTotalOutOfStock(token: string) {
    return sendRequest<IBackendRes<{ totalOutOfStock: number }>>({
      url: `${ANALYTICS}/dashboard-card/total-out-of-stock-product-variants`,
      method: "GET",
      headers: authHeaders(token),
    });
  },

  // --- Paginated tables ---
  getTopSellingVariants(token: string, page = 1, perPage = 10) {
    return sendRequest<IBackendRes<AnalyticsTopSellingVariantDto[]>>({
      url: `${ANALYTICS}/dashboard-card/top-selling-product-variants`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: { page, perPage },
    });
  },
  getTopRevenueUsers(token: string, page = 1, perPage = 10) {
    return sendRequest<IBackendRes<AnalyticsTopRevenueUserDto[]>>({
      url: `${ANALYTICS}/dashboard-card/top-revenue-users`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: { page, perPage },
    });
  },
  getTopRevenueStaffs(token: string, page = 1, perPage = 10) {
    return sendRequest<IBackendRes<AnalyticsTopRevenueUserDto[]>>({
      url: `${ANALYTICS}/dashboard-card/top-revenue-staffs`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: { page, perPage },
    });
  },

  // --- Charts ---
  getPrimaryDashboardChart(token: string, params?: DashboardCardQueryParams) {
    // console.log("[analyticsService] getPrimaryDashboardChart Request:", params);
    return sendRequest<IBackendRes<PrimaryDashboardChartDto>>({
      url: `${ANALYTICS}/primary-dashboard/period-report-chart-data`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: cardParams(params),
    });
  },
  getSecondaryDashboardChart(
    token: string,
    params?: DashboardCardQueryParams & { numberOfRetentionRatePeriods?: number },
  ) {
    // console.log("[analyticsService] getSecondaryDashboardChart Request:", params);
    const q: Record<string, string | number> = { ...cardParams(params) };
    if (params?.numberOfRetentionRatePeriods)
      q.numberOfRetentionRatePeriods = params.numberOfRetentionRatePeriods;
    return sendRequest<IBackendRes<SecondaryDashboardChartDto>>({
      url: `${ANALYTICS}/secondary-dashboard/customers-report-chart-data`,
      method: "GET",
      headers: authHeaders(token),
      queryParams: q,
    });
  },
};
