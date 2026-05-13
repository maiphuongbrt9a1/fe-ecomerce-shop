"use client";


import Header from "@/components/header/Navbar";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { paymentService } from "@/services/payment";
import type {
  ReturnQueryFromVNPayDto,
  VNPayVerifyReturnUrlResponseDto,
} from "@/dto/payment";

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

type PageState = "verifying" | "success" | "failure";

function VNPayReturnContent() {
  const [state, setState] = useState<PageState>("verifying");
  const [result, setResult] = useState<VNPayVerifyReturnUrlResponseDto | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const verifiedRef = useRef(false);

  const searchParams = useSearchParams();
  const { data: session } = useSession();

  useEffect(() => {
    if (verifiedRef.current) return;
    if (!session?.user?.access_token) return;

    verifiedRef.current = true;

    const verify = async () => {
      try {
        // Map query params to ReturnQueryFromVNPayDto
        const vnpData: ReturnQueryFromVNPayDto = {
          vnp_TmnCode: searchParams.get("vnp_TmnCode") || "",
          vnp_Amount: searchParams.get("vnp_Amount") || "",
          vnp_BankCode: searchParams.get("vnp_BankCode") || "",
          vnp_OrderInfo: searchParams.get("vnp_OrderInfo") || "",
          vnp_TransactionNo: searchParams.get("vnp_TransactionNo") || "",
          vnp_ResponseCode: searchParams.get("vnp_ResponseCode") || "",
          vnp_TransactionStatus:
            searchParams.get("vnp_TransactionStatus") || "",
          vnp_TxnRef: searchParams.get("vnp_TxnRef") || "",
          vnp_SecureHash: searchParams.get("vnp_SecureHash") || "",
          vnp_BankTranNo: searchParams.get("vnp_BankTranNo") || undefined,
          vnp_CardType: searchParams.get("vnp_CardType") || undefined,
          vnp_PayDate: searchParams.get("vnp_PayDate") || undefined,
          vnp_SecureHashType:
            searchParams.get("vnp_SecureHashType") || undefined,
        };

        console.log("[VNPayReturn] Verifying payment:", vnpData);

        const response = await paymentService.verifyVNPayReturn(
          { data: vnpData },
          session.user.access_token!,
        );

        console.log("[VNPayReturn] Verification response:", response);

        if (response.data) {
          setResult(response.data);
          if (response.data.isSuccess) {
            setState("success");
          } else {
            setState("failure");
            setErrorMessage(
              response.data.message || "Thanh toán không thành công",
            );
          }
        } else {
          setState("failure");
          setErrorMessage("Không thể xác minh giao dịch");
        }
      } catch (error) {
        console.error("[VNPayReturn] Verification failed:", error);
        setState("failure");
        setErrorMessage(
          error instanceof Error ? error.message : "Lỗi xác minh thanh toán",
        );
      }
    };

    verify();
  }, [session, searchParams]);

  // vnp_TxnRef is the order ID (numeric string)
  const orderId = result?.vnp_TxnRef || searchParams.get("vnp_TxnRef");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-[calc(var(--header-h)_+_1.5rem)]">
        <div className="mx-auto max-w-lg">
          {/* Verifying */}
          {state === "verifying" && (
            <div className="border bg-white p-8 text-center">
              <div className="mb-4 text-4xl">
                <i className="fa-solid fa-spinner fa-spin text-gray-400" />
              </div>
              <h1 className="mb-2 text-xl font-bold">
                ĐANG XÁC MINH THANH TOÁN
              </h1>
              <p className="text-sm text-gray-600">
                Vui lòng đợi trong giây lát...
              </p>
            </div>
          )}

          {/* Success */}
          {state === "success" && (
            <div className="border bg-white p-8 text-center">
              <div className="mb-4 text-5xl">
                <i className="fa-solid fa-circle-check text-green-500" />
              </div>
              <h1 className="mb-2 text-xl font-bold">THANH TOÁN THÀNH CÔNG</h1>
              <p className="mb-6 text-sm text-gray-600">
                Đơn hàng của bạn đã được thanh toán thành công qua VNPay.
              </p>

              <div className="mb-6 space-y-2 border bg-gray-50 p-4 text-left text-sm">
                {orderId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mã đơn hàng</span>
                    <span className="font-semibold">{orderId}</span>
                  </div>
                )}
                {result && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Số tiền</span>
                      <span className="font-semibold">
                        {VND.format(result.vnp_Amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Ngân hàng</span>
                      <span>{result.vnp_BankCode}</span>
                    </div>
                    {result.vnp_TransactionNo && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mã giao dịch</span>
                        <span>{result.vnp_TransactionNo}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-center gap-3">
                <Link
                  href={
                    orderId ? `/profile/orders/${orderId}` : "/profile/orders"
                  }
                  className="inline-block cursor-pointer bg-[var(--bg-button)] px-6 py-3 text-[var(--text-inverse)] transition-colors hover:bg-[var(--bg-button-hover)]"
                >
                  XEM ĐƠN HÀNG
                </Link>
                <Link
                  href="/homepage"
                  className="inline-block cursor-pointer border border-[var(--border-primary)] px-6 py-3 transition-colors hover:bg-gray-100"
                >
                  TRANG CHỦ
                </Link>
              </div>
            </div>
          )}

          {/* Failure */}
          {state === "failure" && (
            <div className="border bg-white p-8 text-center">
              <div className="mb-4 text-5xl">
                <i className="fa-solid fa-circle-xmark text-red-500" />
              </div>
              <h1 className="mb-2 text-xl font-bold">THANH TOÁN THẤT BẠI</h1>
              <p className="mb-6 text-sm text-red-600">{errorMessage}</p>

              {orderId && (
                <div className="mb-6 space-y-2 border bg-gray-50 p-4 text-left text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mã đơn hàng</span>
                    <span className="font-semibold">{orderId}</span>
                  </div>
                  {result?.vnp_ResponseCode && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mã lỗi VNPay</span>
                      <span>{result.vnp_ResponseCode}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-3">
                <Link
                  href={
                    orderId ? `/profile/orders/${orderId}` : "/profile/orders"
                  }
                  className="inline-block cursor-pointer bg-[var(--bg-button)] px-6 py-3 text-[var(--text-inverse)] transition-colors hover:bg-[var(--bg-button-hover)]"
                >
                  XEM ĐƠN HÀNG
                </Link>
                <Link
                  href="/cart"
                  className="inline-block cursor-pointer border border-[var(--border-primary)] px-6 py-3 transition-colors hover:bg-gray-100"
                >
                  VỀ GIỎ HÀNG
                </Link>
                <Link
                  href="/homepage"
                  className="inline-block cursor-pointer border border-[var(--border-primary)] px-6 py-3 transition-colors hover:bg-gray-100"
                >
                  TRANG CHỦ
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Suspense } from "react";
export default function VNPayReturnPage() {
  return (
    <Suspense fallback={null}>
      <VNPayReturnContent />
    </Suspense>
  );
}