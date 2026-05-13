"use client";

import Header from "@/components/header/Navbar";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cartService } from "@/services/cart";
import { useCart } from "@/components/cart/CartContext";
import type { CartItemWithDetails } from "@/dto/cart-api";
import { mapCartItemToDetails } from "@/dto/cart-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export default function CartPage() {
  const [items, setItems] = useState<CartItemWithDetails[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { data: session } = useSession();
  const router = useRouter();
  const { refreshCart } = useCart();

  // Swipe-to-reveal-delete on mobile cards.
  // Only one card can be "open" (revealed) at a time. While dragging we update
  // dragState for visual feedback; on release we snap open or closed.
  const REVEAL_PX = 80;
  const SNAP_PX = 40;
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{ itemId: number; delta: number } | null>(null);
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    axis: "x" | "y" | null;
    openWas: boolean;
  } | null>(null);

  const handleSwipePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    itemId: number,
  ) => {
    if (e.pointerType !== "touch") return;
    swipeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      axis: null,
      openWas: openSwipeId === itemId,
    };
  };

  const handleSwipePointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    itemId: number,
  ) => {
    const s = swipeStartRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (s.axis !== "x") return;
    const base = s.openWas ? -REVEAL_PX : 0;
    let next = base + dx;
    if (next > 0) next = 0;
    if (next < -REVEAL_PX * 1.3) next = -REVEAL_PX * 1.3;
    setDragState({ itemId, delta: next });
  };

  const handleSwipePointerEnd = (itemId: number) => {
    const s = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!s || s.axis !== "x") {
      setDragState(null);
      return;
    }
    const finalDelta =
      dragState?.itemId === itemId ? dragState.delta : s.openWas ? -REVEAL_PX : 0;
    const shouldOpen = finalDelta < -SNAP_PX;
    setOpenSwipeId(shouldOpen ? itemId : null);
    setDragState(null);
  };

  // Load cart from API on mount
  useEffect(() => {
    const loadCart = async () => {
      if (!session?.user?.id || !session?.user?.access_token) {
        console.log("[CartPage] User not authenticated");
        setIsLoading(false);
        return;
      }

      try {
        const userId = parseInt(session.user.id, 10);
        console.log("[CartPage] Loading cart for user:", userId);

        const cartDetailsResponse = await cartService.getCartDetails(
          userId,
          session.user.access_token,
        );

        console.log("[CartPage] Cart details:", cartDetailsResponse);
        const cartItems = cartDetailsResponse.data?.cartItems ?? [];
        setItems(cartItems.map(mapCartItemToDetails));
      } catch (error) {
        console.error("[CartPage] Failed to load cart:", error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, [session]);

  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  const total = useMemo(
    () =>
      items
        .filter((i) => selectedIds.has(i.id))
        .reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0),
    [items, selectedIds],
  );

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((i) => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleItem = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const updateQuantity = async (item: CartItemWithDetails, newQty: number) => {
    if (!session?.user?.access_token) return;
    if (newQty < 1 || newQty > 99) return;

    try {
      console.log("[CartPage] Updating quantity:", { itemId: item.id, newQty });
      await cartService.updateCartItem(
        item.id,
        {
          quantity: newQty,
        },
        session.user.access_token,
      );

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i)),
      );
      await refreshCart();
    } catch (error) {
      console.error("[CartPage] Failed to update quantity:", error);
    }
  };

  const removeItem = async (itemId: number) => {
    if (!session?.user?.access_token) return;

    try {
      console.log("[CartPage] Removing item:", itemId);
      await cartService.deleteCartItem(itemId, session.user.access_token);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      await refreshCart();
    } catch (error) {
      console.error("[CartPage] Failed to remove item:", error);
    }
  };

  const removeSelected = async () => {
    if (!session?.user?.access_token) return;
    if (selectedIds.size === 0) return;

    if (!window.confirm(`Xóa ${selectedIds.size} sản phẩm đã chọn?`)) return;

    const idsToRemove = Array.from(selectedIds);
    try {
      console.log("[CartPage] Removing selected items:", idsToRemove);
      await Promise.all(
        idsToRemove.map((id) =>
          cartService.deleteCartItem(id, session.user.access_token!),
        ),
      );
      setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      await refreshCart();
    } catch (error) {
      console.error("[CartPage] Failed to remove selected items:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6">
          <div className="py-12 text-center">Đang tải...</div>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6">
          <div className="py-12 text-center">
            Vui lòng đăng nhập để xem giỏ hàng
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-3 py-8 md:px-6 pt-[calc(var(--header-h)_+_1.5rem)]">
        <Link
          href="/homepage"
          className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm text-gray-600 hover:text-black"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Tiếp tục mua sắm
        </Link>

        {/* Header Row — desktop only; mobile uses per-card layout */}
        <div className="hidden md:grid grid-cols-[24px_1fr_120px_160px_120px_80px] items-center gap-3 border bg-white px-4 py-3 text-sm text-gray-600">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
            aria-label="Chọn tất cả"
          />
          <div className="font-medium">Sản phẩm</div>
          <div className="justify-self-end">Đơn giá</div>
          <div className="justify-self-center">Số lượng</div>
          <div className="justify-self-end">Số tiền</div>
          <div className="justify-self-end">Thao tác</div>
        </div>

        {/* Items */}
        <div className="mt-4 space-y-4">
          {items.length === 0 ? (
            <div className="bg-white py-12 text-center">
              <p className="text-gray-600">Giỏ hàng của bạn đang trống</p>
            </div>
          ) : (
            items.map((it) => {
              const lineTotal = (it.price || 0) * it.quantity;
              const imageSrc =
                it.imageUrl ||
                "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=240&q=80";
              const isOpen = openSwipeId === it.id;
              const isDragging = dragState?.itemId === it.id;
              const currentDelta = isDragging
                ? dragState!.delta
                : isOpen
                  ? -REVEAL_PX
                  : 0;
              return (
                <div key={it.id} className="bg-white">
                  {/* Mobile card layout — swipe left to reveal Delete */}
                  <div className="overflow-hidden bg-white md:hidden touch-pan-y">
                    {/* Single flex row: card content (w-full) + delete bar (w-20).
                        Total width is wider than the visible area so the bar
                        sits clipped off-screen until the row translates left. */}
                    <div
                      className="flex"
                      style={{
                        transform: `translateX(${currentDelta}px)`,
                        transition: isDragging
                          ? "none"
                          : "transform 200ms ease-out",
                      }}
                      onPointerDown={(e) => handleSwipePointerDown(e, it.id)}
                      onPointerMove={(e) => handleSwipePointerMove(e, it.id)}
                      onPointerUp={() => handleSwipePointerEnd(it.id)}
                      onPointerCancel={() => {
                        swipeStartRef.current = null;
                        setDragState(null);
                      }}
                    >
                      <div className="flex w-full shrink-0 items-start gap-3 bg-white px-4 py-4">
                        <Checkbox
                          checked={selectedIds.has(it.id)}
                          onCheckedChange={(checked) => toggleItem(it.id, checked === true)}
                          aria-label="Chọn sản phẩm"
                          className="self-center shrink-0"
                        />
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-gray-100">
                          <Image
                            src={imageSrc}
                            alt={it.productName || "Product"}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="line-clamp-2 text-sm font-medium text-black">
                            {it.productName || "Product"}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {`${it.variantColor ?? "-"}, ${it.variantSize ?? "-"}`}
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            {VND.format(it.price || 0)}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="inline-flex border">
                              <Button
                                variant="ghost"
                                className="h-auto px-3 py-1.5"
                                onClick={() => updateQuantity(it, it.quantity - 1)}
                                aria-label="Giảm số lượng"
                              >
                                -
                              </Button>
                              <Input
                                className="h-auto w-10 border-x border-y-0 py-1.5 text-center shadow-none focus-visible:ring-0"
                                type="text"
                                readOnly
                                value={it.quantity}
                              />
                              <Button
                                variant="ghost"
                                className="h-auto px-3 py-1.5"
                                onClick={() => updateQuantity(it, it.quantity + 1)}
                                aria-label="Tăng số lượng"
                              >
                                +
                              </Button>
                            </div>
                            <div className="text-sm font-semibold text-black whitespace-nowrap">
                              {VND.format(lineTotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSwipeId(null);
                          removeItem(it.id);
                        }}
                        className="flex w-20 shrink-0 items-center justify-center bg-red-600 text-sm font-semibold text-white"
                        aria-label="Xóa sản phẩm"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>

                  {/* Desktop grid layout */}
                  <div className="hidden md:grid grid-cols-[24px_1fr_120px_160px_120px_80px] items-center gap-3 px-4 py-5">
                    <Checkbox
                      checked={selectedIds.has(it.id)}
                      onCheckedChange={(checked) => toggleItem(it.id, checked === true)}
                      aria-label="Chọn sản phẩm"
                    />

                    {/* Product cell */}
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 overflow-hidden bg-gray-100">
                        <Image
                          src={imageSrc}
                          alt={it.productName || "Product"}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-medium text-black">
                          {it.productName || "Product"}
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <div>
                            Phân loại hàng:{" "}
                            <span className="font-medium">{`${it.variantColor ?? "-"}, ${it.variantSize ?? "-"}`}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unit price */}
                    <div className="justify-self-end text-sm text-gray-700">
                      {VND.format(it.price || 0)}
                    </div>

                    {/* Quantity */}
                    <div className="justify-self-center">
                      <div className="inline-flex border">
                        <Button
                          variant="ghost"
                          className="h-auto px-3 py-2"
                          onClick={() => updateQuantity(it, it.quantity - 1)}
                          aria-label="Giảm số lượng"
                        >
                          -
                        </Button>
                        <Input
                          className="h-auto w-12 border-x border-y-0 py-2 text-center shadow-none focus-visible:ring-0"
                          type="text"
                          readOnly
                          value={it.quantity}
                        />
                        <Button
                          variant="ghost"
                          className="h-auto px-3 py-2"
                          onClick={() => updateQuantity(it, it.quantity + 1)}
                          aria-label="Tăng số lượng"
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="justify-self-end text-sm font-medium text-black">
                      {VND.format(lineTotal)}
                    </div>

                    {/* Actions */}
                    <div className="justify-self-end">
                      <Button
                        variant="ghost"
                        className="h-auto p-0 text-sm text-gray-600 hover:text-red-600"
                        onClick={() => removeItem(it.id)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex flex-col gap-3 border bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex items-center justify-between gap-4 text-sm md:justify-start">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
              Chọn tất cả ({items.length})
            </label>
            <Button
              variant="ghost"
              className="h-auto p-0 text-gray-600 hover:text-red-600"
              onClick={removeSelected}
            >
              Xóa
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:flex-nowrap md:justify-end">
            <div className="text-sm text-gray-700">
              Tổng cộng (
              <span className="font-medium">{selectedCount} Sản phẩm</span>):
            </div>
            <div className="text-xl font-bold text-black">
              {VND.format(total)}
            </div>
            <Button
              className="ml-0 h-auto w-full bg-[var(--bg-button)] px-6 py-3 font-semibold whitespace-nowrap text-[var(--text-inverse)] hover:bg-[var(--bg-button-hover)] disabled:bg-gray-300 md:ml-2 md:w-auto"
              disabled={selectedCount === 0}
              onClick={() => {
                const selectedIdsParam = Array.from(selectedIds).join(",");
                router.push(`/checkout?items=${selectedIdsParam}`);
              }}
            >
              Mua hàng
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
