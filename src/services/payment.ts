import { sendRequest } from "@/utils/api";
import type {
  CreateVNPayPaymentUrlDto,
  VerifyVNPayReturnUrlDto,
  VNPayVerifyReturnUrlResponseDto,
} from "@/dto/payment";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const paymentService = {
  /**
   * Generate VNPay payment URL for redirect
   * POST /payments/vnpay-payment-url
   */
  async createVNPayPaymentUrl(
    data: CreateVNPayPaymentUrlDto,
    accessToken: string
  ): Promise<IBackendRes<string>> {
    const url = `${BACKEND_URL}/payments/vnpay-payment-url`;
    // console.log("[PaymentService] Creating VNPay payment URL:", data);
    const response = await sendRequest<IBackendRes<string>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[PaymentService] VNPay payment URL response:", response);
    return response;
  },

  /**
   * Verify VNPay return URL after payment redirect
   * POST /payments/check-vnpay-return
   */
  async verifyVNPayReturn(
    data: VerifyVNPayReturnUrlDto,
    accessToken: string
  ): Promise<IBackendRes<VNPayVerifyReturnUrlResponseDto>> {
    const url = `${BACKEND_URL}/payments/check-vnpay-return`;
    // console.log("[PaymentService] Verifying VNPay return:", data);
    const response = await sendRequest<IBackendRes<VNPayVerifyReturnUrlResponseDto>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[PaymentService] VNPay verify response:", response);
    return response;
  },
};
