"use client";

export const dynamic = "force-dynamic";


import Header from "@/components/header/Navbar";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cartService } from "@/services/cart";
import { orderService } from "@/services/order";
import { addressService } from "@/services/address";
import { shipmentService } from "@/services/shipment";
import { userService } from "@/services/user";
import { paymentService } from "@/services/payment";
import AddressModal from "@/components/profile/AddressModal";
import { useCart } from "@/components/cart/CartContext";
import type { CartItemWithDetails } from "@/dto/cart-api";
import { mapCartItemToDetails } from "@/dto/cart-api";
import type {
  AddressDto,
  CreateAddressDto,
  CreateAddressForOrderResponseDto,
} from "@/dto/address";
import type {
  CreateOrderDto,
  PaymentMethod,
  PackagesForShipping,
  PackageItemDetailDto,
} from "@/dto/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

type CheckoutStep =
  | "loading"
  | "ready"
  | "previewing"
  | "previewed"
  | "placing";

async function getClientIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = (await res.json()) as { ip: string };
    return data.ip;
  } catch {
    console.log("[CheckoutPage] Failed to fetch client IP, using fallback");
    return "127.0.0.1";
  }
}

function CheckoutContent() {
  // Cart state
  const [items, setItems] = useState<CartItemWithDetails[]>([]);
  const [itemsReady, setItemsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // User profile state
  const [phone, setPhone] = useState("");
  const [phoneLoaded, setPhoneLoaded] = useState(false);
  const [profileName, setProfileName] = useState("");

  // Address state
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [validatedAddress, setValidatedAddress] =
    useState<CreateAddressForOrderResponseDto | null>(null);

  // Shipping preview state
  const [packages, setPackages] = useState<PackagesForShipping | null>(null);
  const [step, setStep] = useState<CheckoutStep>("loading");
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Order state
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Refs to prevent re-fetching on session refresh (NextAuth re-polls on tab focus)
  const cartLoadedRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const addressesLoadedRef = useRef(false);

  // Ref to prevent duplicate preview calls
  const previewAbortRef = useRef<AbortController | null>(null);

  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshCart } = useCart();
  const isBuyNow = searchParams.get("buyNow") === "1";
  const selectedItemIdsParam = searchParams.get("items") || "";
  const selectedItemIds = selectedItemIdsParam
    ? selectedItemIdsParam.split(",").map(Number)
    : [];

  // ── Load user profile (for phone pre-fill) ──
  useEffect(() => {
    if (profileLoadedRef.current) return;
    const loadProfile = async () => {
      if (!session?.user?.id || !session?.user?.access_token) return;
      profileLoadedRef.current = true;
      try {
        const res = await userService.getUser(
          session.user.id,
          session.user.access_token,
        );
        if (res.data?.phone) {
          setPhone(res.data.phone);
        }
        const d = res.data;
        if (d) {
          const name =
            d.firstName || d.lastName
              ? [d.lastName, d.firstName].filter(Boolean).join(" ")
              : d.name || session.user.name || "";
          setProfileName(name);
        }
      } catch (error) {
        console.error("[CheckoutPage] Failed to load user profile:", error);
      } finally {
        setPhoneLoaded(true);
      }
    };
    loadProfile();
  }, [session]);

  // ── Load cart items (or read buy-now item from sessionStorage) ──
  useEffect(() => {
    if (cartLoadedRef.current) return;
    if (sessionStatus === "loading") return;

    const loadCart = async () => {
      if (!session?.user?.id || !session?.user?.access_token) {
        console.log("[CheckoutPage] User not authenticated");
        const returnPath = "/checkout" + (isBuyNow ? "?buyNow=1" : "");
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(returnPath)}`);
        return;
      }

      cartLoadedRef.current = true;

      // ── Buy-now fast path ──
      if (isBuyNow) {
        try {
          const raw = sessionStorage.getItem("buyNowItem");
          if (!raw) throw new Error("Không tìm thấy thông tin sản phẩm");
          const buyNow = JSON.parse(raw) as {
            productVariantId: number;
            quantity: number;
            price: number;
            productName: string;
            variantSize: string | null;
            variantColor: string | null;
            imageUrl: string | null;
          };
          sessionStorage.removeItem("buyNowItem");
          console.log("[CheckoutPage] Buy-now item:", buyNow);
          setItems([
            {
              id: 0, // synthetic — no real cart item
              cartId: 0,
              productVariantId: buyNow.productVariantId,
              quantity: buyNow.quantity,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              productName: buyNow.productName,
              variantSize: buyNow.variantSize,
              variantColor: buyNow.variantColor,
              price: buyNow.price,
              imageUrl: buyNow.imageUrl,
            },
          ]);
          setItemsReady(true);
          setStep("ready");
        } catch (error) {
          console.error("[CheckoutPage] Buy-now load failed:", error);
          router.push("/");
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // ── Normal cart path ──
      try {
        const userId = parseInt(session.user.id, 10);
        console.log("[CheckoutPage] Loading cart for user:", userId);

        const cartDetailsResponse = await cartService.getCartDetails(
          userId,
          session.user.access_token,
        );

        const cartItems = cartDetailsResponse.data?.cartItems ?? [];

        if (cartItems.length === 0) {
          console.log("[CheckoutPage] Cart is empty, redirecting...");
          router.push("/cart");
          return;
        }

        const filteredItems =
          selectedItemIds.length > 0
            ? cartItems.filter((ci) => selectedItemIds.includes(ci.id))
            : cartItems;

        if (filteredItems.length === 0) {
          console.log("[CheckoutPage] No selected items found, redirecting...");
          router.push("/cart");
          return;
        }

        setItems(filteredItems.map(mapCartItemToDetails));
        setItemsReady(true);
        setStep("ready");
      } catch (error) {
        console.error("[CheckoutPage] Failed to load cart:", error);
        router.push("/cart");
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionStatus, router]);

  // ── Load addresses ──
  useEffect(() => {
    if (addressesLoadedRef.current) return;
    const loadAddresses = async () => {
      if (!session?.user?.id || !session?.user?.access_token) return;
      addressesLoadedRef.current = true;

      try {
        const userId = parseInt(session.user.id, 10);
        const response = await addressService.getUserAddresses(
          userId,
          session.user.access_token,
        );
        const addressList = Array.isArray(response.data) ? response.data : [];
        setAddresses(addressList);

        if (addressList.length > 0 && !selectedAddressId) {
          setSelectedAddressId(addressList[0].id);
        }
      } catch (error) {
        console.error("[CheckoutPage] Failed to load addresses:", error);
      }
    };

    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Auto-preview when address changes (after items are loaded) ──
  useEffect(() => {
    if (!selectedAddressId || !itemsReady || items.length === 0) return;
    if (!session?.user?.id || !session?.user?.access_token) return;

    const selectedAddr = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddr) return;

    // Abort any in-flight preview
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    const abortController = new AbortController();
    previewAbortRef.current = abortController;

    const runPreview = async () => {
      setValidatedAddress(null);
      setPackages(null);
      setPreviewError(null);
      setOrderError(null);
      setStep("previewing");

      try {
        const userId = parseInt(session.user.id, 10);

        // Step 1: Validate address with GHN
        console.log("[CheckoutPage] Validating address with GHN...");
        const addressData: CreateAddressDto = {
          userId,
          street: selectedAddr.street,
          ward: selectedAddr.ward,
          district: selectedAddr.district,
          province: selectedAddr.province,
          zipCode: selectedAddr.zipCode,
          country: selectedAddr.country,
        };

        const orderAddressResponse = await addressService.createOrderAddress(
          addressData,
          session.user.access_token,
        );

        if (abortController.signal.aborted) return;

        if (!orderAddressResponse.data) {
          throw new Error("Không thể xác thực địa chỉ với hệ thống vận chuyển");
        }

        const validated = orderAddressResponse.data;
        setValidatedAddress(validated);
        console.log("[CheckoutPage] Address validated:", validated);

        // Step 2: Preview shipping fee + discounts
        console.log("[CheckoutPage] Previewing shipping fee...");
        const orderItems = items.map((i) => ({
          productVariantId: i.productVariantId,
          quantity: i.quantity,
        }));

        const previewResponse =
          await shipmentService.previewShippingFeeForOrder(
            { orderItems, createNewAddressForOrderResponseDto: validated },
            session.user.access_token,
          );

        if (abortController.signal.aborted) return;

        if (!previewResponse.data) {
          throw new Error("Không thể tính phí vận chuyển");
        }

        setPackages(previewResponse.data);
        setStep("previewed");
        console.log("[CheckoutPage] Preview complete:", previewResponse.data);
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("[CheckoutPage] Preview failed:", error);
        const msg =
          error instanceof Error
            ? error.message
            : "Lỗi khi tính phí vận chuyển";
        setPreviewError(msg);
        setStep("ready");
      }
    };

    runPreview();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddressId, itemsReady]);

  // ── Aggregate pricing from packages ──
  const priceSummary = (() => {
    if (!packages) return null;

    let subTotal = 0;
    let totalShippingFee = 0;
    let totalItemDiscount = 0;
    let totalPackageDiscount = 0;
    const allItems: PackageItemDetailDto[] = [];

    for (const pkg of Object.values(packages)) {
      const detail = pkg.PackageDetail;
      subTotal += detail.subTotalPriceForPackage;
      totalShippingFee += detail.shippingFee;
      totalPackageDiscount += detail.specialUserDiscountAmountForPackage;
      allItems.push(...detail.packageItems);

      for (const item of detail.packageItems) {
        totalItemDiscount += item.totalDiscountAmount;
      }
    }

    const totalDiscount = totalItemDiscount + totalPackageDiscount;
    // subTotalPriceForPackage is already net of item-level discounts, and
    // totalPriceForPackage is the BE-authoritative order total. Sum that directly
    // instead of re-deriving — otherwise item discounts get subtracted twice.
    const totalAmount = Object.values(packages).reduce(
      (sum, pkg) => sum + pkg.PackageDetail.totalPriceForPackage,
      0,
    );

    return {
      subTotal,
      totalShippingFee,
      totalItemDiscount,
      totalPackageDiscount,
      totalDiscount,
      totalAmount,
      allItems,
    };
  })();

  // ── Place order ──
  const handlePlaceOrder = async () => {
    if (!session?.user?.id || !session?.user?.access_token) return;
    if (!validatedAddress || !packages) return;

    if (!phone.trim()) {
      setOrderError("Vui lòng nhập số điện thoại người nhận");
      return;
    }

    setStep("placing");
    setOrderError(null);

    try {
      const userId = parseInt(session.user.id, 10);

      const orderData: CreateOrderDto = {
        userId,
        paymentMethod,
        carrier: "Giao hàng nhanh",
        phone: phone.trim(),
        description: description.trim() || undefined,
        shippingAddress: validatedAddress,
        packages,
      };

      console.log("[CheckoutPage] Creating order:", orderData);
      const orderResponse = await orderService.createOrder(
        orderData,
        session.user.access_token,
      );

      if (!orderResponse.data?.id) {
        throw new Error("Không thể tạo đơn hàng");
      }

      const orderId = orderResponse.data.id;
      console.log("[CheckoutPage] Order created:", orderId);

      // Delete cart items after successful order (skip buy-now synthetic items)
      await Promise.all(
        items
          .filter((item) => item.id > 0)
          .map((item) =>
            cartService.deleteCartItem(item.id, session.user.access_token!),
          ),
      );

      // Cart is now empty on the server; refresh the badge before navigating
      // away so the header icon doesn't carry stale state into the next page.
      await refreshCart();

      if (paymentMethod === "VNPAY") {
        // VNPay: generate payment URL and redirect to gateway
        console.log(
          "[CheckoutPage] Generating VNPay payment URL for order:",
          orderId,
        );
        const clientIp = await getClientIp();
        const vnpayResponse = await paymentService.createVNPayPaymentUrl(
          {
            data: {
              vnp_Amount: priceSummary!.totalAmount,
              vnp_TxnRef: String(orderId),
              vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
              vnp_IpAddr: clientIp,
              vnp_ReturnUrl: `${window.location.origin}/checkout/vnpay-return`,
              vnp_Locale: "vn",
              vnp_CurrCode: "VND",
              vnp_OrderType: "other",
            },
          },
          session.user.access_token,
        );

        if (!vnpayResponse.data) {
          throw new Error("Không thể tạo liên kết thanh toán VNPay");
        }

        console.log("[CheckoutPage] Redirecting to VNPay gateway");
        window.location.href = vnpayResponse.data;
        return;
      }

      // COD: go directly to the order detail page
      router.push(`/profile/orders/${orderId}`);
    } catch (error) {
      console.error("[CheckoutPage] Failed to place order:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Đặt hàng thất bại. Vui lòng thử lại.";
      setOrderError(msg);
      setStep("previewed");
    }
  };

  // ── Helpers ──
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const recipientName = profileName || session?.user?.name || "";

  const handleAddressChange = (value: string) => {
    if (value === "new") {
      setIsAddressModalOpen(true);
    } else {
      setSelectedAddressId(parseInt(value, 10));
    }
  };

  const handleAddressModalSuccess = async () => {
    if (!session?.user?.id || !session?.user?.access_token) return;
    try {
      const userId = parseInt(session.user.id, 10);
      const response = await addressService.getUserAddresses(
        userId,
        session.user.access_token,
      );
      const addressList = Array.isArray(response.data) ? response.data : [];
      setAddresses(addressList);
      if (addressList.length > 0) {
        setSelectedAddressId(addressList[addressList.length - 1].id);
      }
    } catch (error) {
      console.error("[CheckoutPage] Failed to reload addresses:", error);
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 pt-[calc(var(--header-h)_+_1.5rem)]">
          <div className="text-center text-gray-600">Đang tải...</div>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-[calc(var(--header-h)_+_1.5rem)]">
        <Link
          href="/cart"
          className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600 hover:text-black"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Quay lại giỏ hàng
        </Link>
        <h1 className="mb-6 text-2xl font-bold">THANH TOÁN</h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Shipping address */}
            <div className="border bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">THÔNG TIN GIAO HÀNG</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Chọn địa chỉ giao hàng{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={
                      selectedAddressId ? String(selectedAddressId) : undefined
                    }
                    onValueChange={handleAddressChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="-- Chọn địa chỉ --" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => {
                        const fullAddress = `${addr.street}, ${addr.ward}, ${addr.district}, ${addr.province}`;
                        return (
                          <SelectItem key={addr.id} value={String(addr.id)}>
                            {fullAddress}
                          </SelectItem>
                        );
                      })}
                      <SelectItem value="new" className="font-semibold">
                        + Thêm địa chỉ mới
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected address card with recipient info */}
                {selectedAddress && (
                  <div className="border border-gray-200 bg-gray-50 p-4 text-sm">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="font-semibold">{recipientName}</span>
                      {phone && <span className="text-gray-600">{phone}</span>}
                    </div>
                    <div className="text-gray-700">
                      {selectedAddress.street}, {selectedAddress.ward},{" "}
                      {selectedAddress.district}, {selectedAddress.province}
                      {selectedAddress.zipCode &&
                        `, ${selectedAddress.zipCode}`}
                      <br />
                      {selectedAddress.country}
                    </div>
                    {step === "previewing" && (
                      <div className="mt-3 flex items-center gap-2 border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                        <i className="fa-solid fa-spinner fa-spin" />
                        Đang xác thực địa chỉ và tính phí vận chuyển...
                      </div>
                    )}
                  </div>
                )}

                {addresses.length === 0 && (
                  <div className="border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                    <i className="fa-solid fa-circle-info mr-2" />
                    Bạn chưa có địa chỉ nào. Vui lòng thêm địa chỉ để tiếp tục.
                  </div>
                )}

                {previewError && (
                  <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {previewError}
                  </div>
                )}

                {/* Phone number (pre-filled from profile) */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Số điện thoại người nhận{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    placeholder={
                      phoneLoaded ? "Nhập số điện thoại" : "Đang tải..."
                    }
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {/* Order description */}
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Ghi chú đơn hàng
                  </label>
                  <Textarea
                    className="resize-none"
                    rows={2}
                    placeholder="Ghi chú cho người bán (không bắt buộc)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="border bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">PHƯƠNG THỨC THANH TOÁN</h2>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as PaymentMethod)
                }
                className="space-y-3"
              >
                <Label className="flex cursor-pointer items-center gap-3 font-normal">
                  <RadioGroupItem value="COD" />
                  <span className="text-sm">
                    Thanh toán khi nhận hàng (COD)
                  </span>
                </Label>
                <Label className="flex cursor-pointer items-center gap-3 font-normal">
                  <RadioGroupItem value="VNPAY" />
                  <span className="text-sm">Thanh toán qua VNPay</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Package items detail (shown after preview) */}
            {priceSummary && (
              <div className="border bg-white p-6">
                <h2 className="mb-4 text-lg font-bold">CHI TIẾT SẢN PHẨM</h2>
                <div className="space-y-3">
                  {priceSummary.allItems.map((item, idx) => (
                    <div
                      key={`${item.productVariantId}-${idx}`}
                      className="flex items-start gap-3 border-b pb-3 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {item.productVariantName}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {[item.productVariantColor, item.productVariantSize]
                            .filter(Boolean)
                            .join(", ")}
                          {" | SKU: "}
                          {item.productVariantSKU}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {item.totalDiscountAmount > 0 ? (
                            <>
                              <span className="text-xs text-gray-400 line-through">
                                {VND.format(item.subTotalPrice)}
                              </span>
                              <span className="text-xs font-medium text-black">
                                {VND.format(item.totalPrice)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-600">
                              {VND.format(item.unitPrice)} x {item.quantity}
                            </span>
                          )}
                        </div>
                        {/* Discount detail — always show row */}
                        <div className="mt-1 text-xs">
                          {item.totalDiscountAmount > 0 ? (
                            <span className="text-green-600">
                              {item.discountType === "PERCENTAGE"
                                ? `Giảm ${item.discountValue}%`
                                : `Giảm ${VND.format(item.discountValue)}`}
                              {" → -"}
                              {VND.format(item.totalDiscountAmount)}
                              {item.appliedVoucher && (
                                <span className="ml-1 border border-green-300 px-1">
                                  {item.appliedVoucher.code}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              Không có giảm giá
                            </span>
                          )}
                        </div>
                        {item.discountDescription &&
                          item.discountDescription !==
                            "No discount applied" && (
                            <div className="mt-0.5 text-xs text-gray-500 italic">
                              {item.discountDescription}
                            </div>
                          )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium whitespace-nowrap">
                          {VND.format(item.totalPrice)}
                        </div>
                        <div className="text-xs text-gray-500">
                          x{item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Package-level voucher detail */}
                  {Object.values(packages!).map((pkg, pkgIdx) => {
                    const detail = pkg.PackageDetail;
                    return (
                      <div key={pkgIdx}>
                        {detail.userVoucher ? (
                          <div className="mt-2 flex items-center justify-between border border-green-200 bg-green-50 px-3 py-2 text-xs">
                            <span className="text-green-700">
                              Voucher giảm giá gói hàng:{" "}
                              <span className="border border-green-300 px-1 font-medium">
                                {detail.userVoucher.voucher?.code}
                              </span>
                            </span>
                            <span className="font-medium text-green-700">
                              -
                              {VND.format(
                                detail.specialUserDiscountAmountForPackage,
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center justify-between border border-dashed px-3 py-2 text-xs text-gray-400">
                            <span>Voucher gói hàng</span>
                            <span>Không có voucher áp dụng</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-36 border bg-white p-6">
              <h2 className="mb-4 text-lg font-bold">ĐƠN HÀNG</h2>

              {/* Cart items preview (before shipping preview) */}
              {!priceSummary && (
                <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 border-b pb-3">
                      {item.imageUrl && (
                        <div className="relative h-16 w-16 flex-shrink-0 border">
                          <Image
                            src={item.imageUrl}
                            alt={item.productName || "Product"}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {item.productName}
                        </div>
                        {(item.variantSize || item.variantColor) && (
                          <div className="text-xs text-gray-600">
                            {[item.variantSize, item.variantColor]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}
                        <div className="text-sm">
                          {VND.format(item.price || 0)} x {item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Price breakdown */}
              <div className="space-y-2 border-t pt-4 text-sm">
                {priceSummary ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tạm tính</span>
                      <span>{VND.format(priceSummary.subTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phí vận chuyển</span>
                      <span>{VND.format(priceSummary.totalShippingFee)}</span>
                    </div>
                    <div
                      className={`flex justify-between ${priceSummary.totalItemDiscount > 0 ? "text-green-600" : "text-gray-400"}`}
                    >
                      <span>Giảm giá sản phẩm</span>
                      <span>
                        {priceSummary.totalItemDiscount > 0
                          ? `-${VND.format(priceSummary.totalItemDiscount)}`
                          : VND.format(0)}
                      </span>
                    </div>
                    <div
                      className={`flex justify-between ${priceSummary.totalPackageDiscount > 0 ? "text-green-600" : "text-gray-400"}`}
                    >
                      <span>Voucher giảm giá</span>
                      <span>
                        {priceSummary.totalPackageDiscount > 0
                          ? `-${VND.format(priceSummary.totalPackageDiscount)}`
                          : VND.format(0)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg font-bold">
                      <span>Tổng cộng</span>
                      <span>{VND.format(priceSummary.totalAmount)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tạm tính</span>
                      <span>
                        {VND.format(
                          items.reduce(
                            (sum, i) => sum + (i.price || 0) * i.quantity,
                            0,
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Phí vận chuyển</span>
                      <span>
                        {step === "previewing"
                          ? "Đang tính..."
                          : "Chọn địa chỉ để tính"}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Giảm giá sản phẩm</span>
                      <span>--</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Voucher giảm giá</span>
                      <span>--</span>
                    </div>
                  </>
                )}
              </div>

              {/* Shipping info from preview */}
              {packages && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-2 text-sm font-semibold">VẬN CHUYỂN</h3>
                  {Object.entries(packages).map(([shopId, pkg]) => {
                    const detail = pkg.PackageDetail;
                    const eta = detail.expectedDeliveryTime;
                    const etaDate = eta?.leadtime
                      ? new Date(eta.leadtime * 1000).toLocaleDateString(
                          "vi-VN",
                        )
                      : null;
                    return (
                      <div
                        key={shopId}
                        className="space-y-1 text-xs text-gray-600"
                      >
                        <div>
                          <span className="font-medium">
                            {detail.shippingService?.short_name || "GHN"}
                          </span>
                          {" - "}
                          {VND.format(detail.shippingFee)}
                        </div>
                        {etaDate && <div>Dự kiến giao: {etaDate}</div>}
                        <div>
                          Từ: {detail.ghnProvinceName}, {detail.ghnDistrictName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Order error */}
              {orderError && (
                <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {orderError}
                </div>
              )}

              {/* Place order button */}
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={step !== "previewed" || !phone.trim()}
                className="mt-4 h-auto w-full bg-[var(--bg-button)] py-3 text-[var(--text-inverse)] hover:bg-[var(--bg-button-hover)] disabled:bg-gray-400"
              >
                {step === "placing" ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />
                    Đang xử lý...
                  </>
                ) : (
                  "ĐẶT HÀNG"
                )}
              </Button>

              {step !== "previewed" && step !== "placing" && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  {step === "previewing"
                    ? "Đang tính phí vận chuyển..."
                    : "Chọn địa chỉ giao hàng để tiếp tục"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Order Confirmation Overlay */}
        {showConfirm && priceSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md border bg-white p-6">
              <h3 className="mb-4 text-lg font-bold">XÁC NHẬN ĐẶT HÀNG</h3>

              <div className="space-y-3 text-sm">
                {selectedAddress && (
                  <div>
                    <span className="text-gray-600">Giao đến:</span>
                    <p className="mt-1 font-medium">
                      {recipientName}
                      {phone ? ` — ${phone}` : ""}
                    </p>
                    <p className="mt-0.5 text-gray-600">
                      {selectedAddress.street}, {selectedAddress.ward},{" "}
                      {selectedAddress.district}, {selectedAddress.province}
                    </p>
                  </div>
                )}

                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Phương thức thanh toán</span>
                  <span className="font-medium">
                    {paymentMethod === "COD"
                      ? "Thanh toán khi nhận hàng"
                      : "VNPay"}
                  </span>
                </div>

                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Tổng cộng</span>
                  <span>{VND.format(priceSummary.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="h-auto flex-1 border-[var(--border-primary)] py-3"
                >
                  Hủy
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirm(false);
                    handlePlaceOrder();
                  }}
                  className="h-auto flex-1 bg-[var(--bg-button)] py-3 text-[var(--text-inverse)] hover:bg-[var(--bg-button-hover)]"
                >
                  Xác nhận đặt hàng
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Address Modal */}
        <AddressModal
          isOpen={isAddressModalOpen}
          onClose={() => setIsAddressModalOpen(false)}
          onSuccess={handleAddressModalSuccess}
          editAddress={null}
        />
      </div>
    </div>
  );
}

import { Suspense } from "react";
export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  );
}