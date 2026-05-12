import { sendRequest } from "@/utils/api";
import type { PreviewFeeAndDiscountAndPriceForOrderDto } from "@/dto/shipment";
import type { PreviewPackageDetailWithChecksumDto } from "@/dto/order";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const shipmentService = {
  /**
   * Preview shipping fee, discount, and price detail for an order
   * POST /shipments/preview-shipping-fee-detail-and-discount-detail-and-price-detail-for-order
   * Returns packages grouped by GHN shop ID
   */
  async previewShippingFeeForOrder(
    data: PreviewFeeAndDiscountAndPriceForOrderDto,
    accessToken: string
  ): Promise<IBackendRes<Record<string, PreviewPackageDetailWithChecksumDto>>> {
    const url = `${BACKEND_URL}/shipments/preview-shipping-fee-detail-and-discount-detail-and-price-detail-for-order`;
    // console.log("[ShipmentService] Previewing shipping fee:", data);
    const response = await sendRequest<
      IBackendRes<Record<string, PreviewPackageDetailWithChecksumDto>>
    >({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ShipmentService] Preview response:", response);
    return response;
  },

  async getGHNTrackingUrl(
    orderId: number,
    accessToken: string
  ): Promise<IBackendRes<string>> {
    const url = `${BACKEND_URL}/shipments/${orderId}/ghn-tracking-url`;
    // console.log("[ShipmentService] Fetching GHN tracking URL for order:", orderId);
    const response = await sendRequest<IBackendRes<string>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ShipmentService] GHN tracking URL response:", response);
    return response;
  },
};
