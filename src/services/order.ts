import { sendRequest } from "@/utils/api";
import type {
  CreateOrderDto,
  UpdateOrderDto,
  OrderDto,
  OrderFullInformationEntity,
  CreateOrderItemDto,
  UpdateOrderItemDto,
  OrderItemDto,
  GhnPickShift,
  UpdateOrderToWaitingPickupDto,
  UpdateOrderStatusWithStaffDto,
} from "@/dto/order";
import type { ReviewDto } from "@/dto/product-detail";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const orderService = {
  /**
   * Create a new order (real flow with packages + shipping address)
   */
  async createOrder(
    data: CreateOrderDto,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders`;
    // console.log("[OrderService] Creating order:", data);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Create order response:", response);
    return response;
  },

  async getUserOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get user orders response:", response);
    return response;
  },

  async getUserConfirmedOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/confirmed-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching confirmed orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get confirmed orders response:", response);
    return response;
  },

  async getUserShippedOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/shipped-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching shipped orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get shipped orders response:", response);
    return response;
  },

  async getUserDeliveredOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/delivered-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching delivered orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get delivered orders response:", response);
    return response;
  },

  async getUserCompletedOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/completed-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching completed orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get completed orders response:", response);
    return response;
  },

  async getUserCancelledOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/cancelled-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching cancelled orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get cancelled orders response:", response);
    return response;
  },

  async getUserReturnedOrders(
    userId: number,
    accessToken: string,
    page = 1,
    perPage = 20
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/user/${userId}/returned-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching returned orders for user:", userId, { page, perPage });
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get returned orders response:", response);
    return response;
  },

  async getOrderById(
    orderId: number,
    accessToken: string
  ): Promise<IBackendRes<OrderDto>> {
    const url = `${BACKEND_URL}/orders/${orderId}`;
    // console.log("[OrderService] Fetching order:", orderId);
    const response = await sendRequest<IBackendRes<OrderDto>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Get order response:", response);
    return response;
  },

  async updateOrder(
    orderId: number,
    data: UpdateOrderDto,
    accessToken: string
  ): Promise<IBackendRes<OrderDto>> {
    const url = `${BACKEND_URL}/orders/${orderId}`;
    // console.log("[OrderService] Updating order:", { orderId, data });
    const response = await sendRequest<IBackendRes<OrderDto>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Update order response:", response);
    return response;
  },

  async createOrderItem(
    data: CreateOrderItemDto,
    accessToken: string
  ): Promise<IBackendRes<OrderItemDto>> {
    const url = `${BACKEND_URL}/order-items`;
    // console.log("[OrderService] Creating order item:", data);
    const response = await sendRequest<IBackendRes<OrderItemDto>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Create order item response:", response);
    return response;
  },

  async updateOrderItem(
    itemId: number,
    data: UpdateOrderItemDto,
    accessToken: string
  ): Promise<IBackendRes<OrderItemDto>> {
    const url = `${BACKEND_URL}/order-items/${itemId}`;
    // console.log("[OrderService] Updating order item:", { itemId, data });
    const response = await sendRequest<IBackendRes<OrderItemDto>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Update order item response:", response);
    return response;
  },

  async getOrderDetail(
    orderId: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/order-detail`;
    // console.log("[OrderService] Fetching order detail:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Order detail response:", response);
    return response;
  },

  async cancelOrder(
    orderId: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/cancel`;
    // console.log("[OrderService] Cancelling order:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Cancel order response:", response);
    return response;
  },

  async getAllOrderDetails(
    page: number,
    perPage: number,
    accessToken: string,
    options: {
      statusFilter?:
        | "all"
        | "waiting"
        | "shipping"
        | "delivered"
        | "pending_return"
        | "returned"
        | "cancelled";
      search?: string;
    } = {}
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    if (options.statusFilter && options.statusFilter !== "all") {
      params.set("statusFilter", options.statusFilter);
    }
    const trimmed = options.search?.trim();
    if (trimmed) params.set("search", trimmed);
    const url = `${BACKEND_URL}/orders/order-detail-list?${params.toString()}`;
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopConfirmedOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/confirmed-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching confirmed orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopWaitingPickupOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/waiting-for-ghn-pickup-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching waiting pickup orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopShippedOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/shipped-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching shipped orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopDeliveredOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/delivered-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching delivered orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopCompletedOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/completed-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching completed orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopCancelledOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/cancelled-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching cancelled orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getGhnPickShifts(
    accessToken: string
  ): Promise<IBackendRes<GhnPickShift[]>> {
    const url = `${BACKEND_URL}/orders/ghn/pick-shift-list`;
    // console.log("[OrderService] Fetching GHN pick shifts");
    const response = await sendRequest<IBackendRes<GhnPickShift[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async updateOrderToWaitingPickup(
    orderId: number,
    data: UpdateOrderToWaitingPickupDto,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/waiting-pickup`;
    // console.log("[OrderService] Updating order to waiting-pickup:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async updateOrderToShipped(
    orderId: number,
    data: UpdateOrderStatusWithStaffDto,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/shipped`;
    // console.log("[OrderService] Updating order to shipped:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async updateOrderToDelivered(
    orderId: number,
    data: UpdateOrderStatusWithStaffDto,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/delivered`;
    // console.log("[OrderService] Updating order to delivered:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async updateOrderToDeliveryFailed(
    orderId: number,
    data: UpdateOrderStatusWithStaffDto,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/delivery-failed`;
    // console.log("[OrderService] Updating order to delivery-failed:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopReturnedOrders(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/returned-order-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching returned orders page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getShopOrdersWithPendingReturn(
    page: number,
    perPage: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity[]>> {
    const url = `${BACKEND_URL}/orders/shop/pending-return-request-list?page=${page}&perPage=${perPage}`;
    // console.log("[OrderService] Fetching orders with pending return page:", page);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getMyReviewsForOrder(
    orderId: number,
    accessToken: string
  ): Promise<IBackendRes<ReviewDto[]>> {
    const url = `${BACKEND_URL}/orders/${orderId}/my-reviews`;
    // console.log("[OrderService] Fetching my reviews for order:", orderId);
    const response = await sendRequest<IBackendRes<ReviewDto[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] My reviews response:", response);
    return response;
  },

  async confirmReceived(
    orderId: number,
    accessToken: string
  ): Promise<IBackendRes<OrderFullInformationEntity>> {
    const url = `${BACKEND_URL}/orders/${orderId}/user-confirm-received`;
    // console.log("[OrderService] Confirming order received:", orderId);
    const response = await sendRequest<IBackendRes<OrderFullInformationEntity>>({
      url,
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Confirm received response:", response);
    return response;
  },

  async deleteOrderItem(
    itemId: number,
    accessToken: string
  ): Promise<IBackendRes<void>> {
    const url = `${BACKEND_URL}/order-items/${itemId}`;
    // console.log("[OrderService] Deleting order item:", itemId);
    const response = await sendRequest<IBackendRes<void>>({
      url,
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[OrderService] Delete order item response:", response);
    return response;
  },
};
