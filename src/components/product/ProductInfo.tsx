"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ColorSwatch from "./ColorSwatch";
import type { ProductVariantEntity } from "@/dto/product-variant";
import type { ColorEntity } from "@/dto/color";
import { cartService } from "@/services/cart";
import { useCart } from "@/components/cart/CartContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare } from "lucide-react";
import { serializeProductCard, type ProductAttachment } from "@/utils/chat-product";
import { getOrCreateCartId } from "@/utils/cart-helpers";
import {
  redirectToLoginWithIntent,
  readAuthIntent,
  clearAuthIntent,
  type BuyNowSnapshot,
} from "@/utils/auth-intent";
import { usePathname } from "next/navigation";

interface ProductInfoProps {
    productId: number;
    productImageUrl: string;
    brand: string;
    name: string;
    rating: number;
    reviewCount: number;
    basePrice: number;
    viewersCount: number;
    baseStock: number;
    variants: ProductVariantEntity[];
    colors: ColorEntity[];
    onColorChange?: (colorId: number) => void;
}

export default function ProductInfo({
    productId,
    productImageUrl,
    brand,
    name,
    rating,
    reviewCount,
    basePrice,
    viewersCount,
    baseStock,
    variants,
    colors,
    onColorChange,
}: ProductInfoProps) {
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [selectedColorId, setSelectedColorId] = useState<number | null>(null);

    // Build color lookup: colorId → ColorEntity
    const colorMap = useMemo(() => new Map(colors.map((c) => [c.id, c])), [colors]);

    // Extract unique sizes from variants (ordered by first appearance)
    const allSizes = useMemo(() => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const v of variants) {
            const size = v.variantSize?.toUpperCase();
            if (size && !seen.has(size)) {
                seen.add(size);
                result.push(size);
            }
        }
        return result;
    }, [variants]);

    // Extract unique colorIds present in this product's variants
    const allColorIds = useMemo(() => {
        const seen = new Set<number>();
        const result: number[] = [];
        for (const v of variants) {
            if (v.colorId && !seen.has(v.colorId)) {
                seen.add(v.colorId);
                result.push(v.colorId);
            }
        }
        return result;
    }, [variants]);
    const [quantity, setQuantity] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const { data: session } = useSession();
    const router = useRouter();
    const { refreshCart } = useCart();

    // Find the currently selected variant based on size and colorId
    const selectedVariant = useMemo(() => {
        if (!selectedSize || !selectedColorId) return null;

        return variants.find(v =>
            v.variantSize?.toUpperCase() === selectedSize.toUpperCase() &&
            v.colorId === selectedColorId
        ) || null;
    }, [selectedSize, selectedColorId, variants]);

    // Get available sizes (those with total stock > 0 across all colors)
    const availableSizes = useMemo(() => {
        const sizeStockMap = new Map<string, number>();

        variants.forEach(v => {
            if (v.variantSize) {
                const sizeUpper = v.variantSize.toUpperCase();
                const currentStock = sizeStockMap.get(sizeUpper) || 0;
                sizeStockMap.set(sizeUpper, currentStock + (v.stock || 0));
            }
        });

        return new Set(
            Array.from(sizeStockMap.entries())
                .filter(([_, stock]) => stock > 0)
                .map(([size]) => size)
        );
    }, [variants]);

    // Get available colorIds for the currently selected size (colors with stock > 0)
    const availableColorIds = useMemo(() => {
        if (!selectedSize) return new Set<number>();

        const ids = new Set<number>();
        variants.forEach(v => {
            if (
                v.variantSize?.toUpperCase() === selectedSize.toUpperCase() &&
                v.colorId &&
                (v.stock || 0) > 0
            ) {
                ids.add(v.colorId);
            }
        });
        return ids;
    }, [variants, selectedSize]);

    // Calculate displayed values based on selection
    const displayPrice = selectedVariant?.price || basePrice;
    const displayStock = selectedVariant?.stock || baseStock;
    const originalPrice = useMemo(() => {
        if (!variants.length) return undefined;
        const maxPrice = Math.max(...variants.map(v => v.price));
        return maxPrice > displayPrice ? maxPrice : undefined;
    }, [variants, displayPrice]);
    const discount = originalPrice ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100) : undefined;

    // Auto-select first available size if none selected
    useEffect(() => {
        if (!selectedSize && availableSizes.size > 0) {
            const firstAvailable = allSizes.find(s => availableSizes.has(s));
            if (firstAvailable) setSelectedSize(firstAvailable);
        }
    }, [selectedSize, availableSizes, allSizes]);

    // Auto-select color when size changes or no color selected
    useEffect(() => {
        if (selectedSize && availableColorIds.size > 0) {
            if (selectedColorId && availableColorIds.has(selectedColorId)) {
                return;
            }

            const firstAvailable = allColorIds.find(id => availableColorIds.has(id));
            if (firstAvailable) {
                setSelectedColorId(firstAvailable);
                onColorChange?.(firstAvailable);
            }
        }
    }, [selectedSize, availableColorIds, selectedColorId, allColorIds, onColorChange]);

    const incrementQty = () => setQuantity((q) => Math.min(q + 1, displayStock));
    const decrementQty = () => setQuantity((q) => Math.max(q - 1, 1));

    const pathname = usePathname();
    const replayedRef = useRef(false);

    const buildBuyNowSnapshot = useCallback(
        (variant: ProductVariantEntity, qty: number): BuyNowSnapshot => ({
            productVariantId: variant.id,
            quantity: qty,
            price: variant.price,
            productName: variant.variantName,
            variantSize: variant.variantSize ?? null,
            variantColor: variant.variantColor ?? null,
            imageUrl: null,
        }),
        [],
    );

    const buildChatAttachment = useCallback(
        (variant: ProductVariantEntity | null): ProductAttachment => {
            const variantImageUrl = variant
                ? (variants.find((v) => v.id === variant.id) as (typeof variants[0] & { media?: { url: string }[] }) | undefined)?.media?.[0]?.url
                : undefined;
            return {
                productId,
                productName: name,
                price: variant?.price ?? basePrice,
                imageUrl: variantImageUrl ?? productImageUrl,
                variantId: variant?.id,
                variantSize: variant?.variantSize,
                variantColor: variant?.variantColor,
            };
        },
        [variants, productId, name, basePrice, productImageUrl],
    );

    const performAddToCart = useCallback(
        async (variantId: number, qty: number, navigateToCart: boolean) => {
            if (!session?.user?.id || !session?.user?.access_token) return;
            setIsLoading(true);
            const userId = parseInt(session.user.id, 10);
            console.log("[ProductInfo] Adding to cart:", { variantId, quantity: qty, userId });
            try {
                const cartId = await getOrCreateCartId(userId, session.user.access_token);
                await cartService.createCartItem(
                    userId,
                    { cartId, productVariantId: variantId, quantity: qty },
                    session.user.access_token,
                );
                console.log("[ProductInfo] Cart item created successfully");
                toast.success("Đã thêm vào giỏ hàng");
                await refreshCart();
                if (navigateToCart) router.push("/cart");
            } catch (error) {
                console.error("[ProductInfo] Add to cart failed:", error);
                toast.error("Thêm vào giỏ hàng thất bại");
            } finally {
                setIsLoading(false);
            }
        },
        [session, refreshCart, router],
    );

    const performBuyNow = useCallback((snapshot: BuyNowSnapshot) => {
        console.log("[ProductInfo] Buy now:", snapshot);
        sessionStorage.setItem("buyNowItem", JSON.stringify(snapshot));
        router.push("/checkout?buyNow=1");
    }, [router]);

    const performSendToChat = useCallback((att: ProductAttachment) => {
        console.log("[ProductInfo] Sending to chat:", serializeProductCard(att));
        window.dispatchEvent(new CustomEvent("chatAttachProduct", { detail: att }));
    }, []);

    const handleAddToCart = async () => {
        if (!selectedVariant) return;
        if (!session?.user?.id || !session?.user?.access_token) {
            redirectToLoginWithIntent(
                router,
                {
                    kind: "addToCart",
                    productId,
                    variantId: selectedVariant.id,
                    quantity,
                },
                pathname || "/",
            );
            return;
        }
        await performAddToCart(selectedVariant.id, quantity, false);
    };

    const handleBuyNow = () => {
        if (!selectedVariant) return;
        const snapshot = buildBuyNowSnapshot(selectedVariant, quantity);
        if (!session?.user?.id) {
            redirectToLoginWithIntent(
                router,
                {
                    kind: "buyNow",
                    productId,
                    variantId: selectedVariant.id,
                    quantity,
                    buyNow: snapshot,
                },
                pathname || "/",
            );
            return;
        }
        performBuyNow(snapshot);
    };

    const handleSendToChat = () => {
        const att = buildChatAttachment(selectedVariant);
        if (!session?.user?.id) {
            redirectToLoginWithIntent(
                router,
                {
                    kind: "sendToChat",
                    productId,
                    variantId: selectedVariant?.id ?? 0,
                    quantity,
                    attachment: att,
                },
                pathname || "/",
            );
            return;
        }
        performSendToChat(att);
    };

    // Replay a pending auth intent once after login lands the user back on this product.
    useEffect(() => {
        if (replayedRef.current) return;
        if (!session?.user?.id || !session?.user?.access_token) return;
        const intent = readAuthIntent();
        if (!intent) return;
        if (intent.productId !== productId) return;
        // Only consume intents this component handles; leave others (e.g. addAllToCart)
        // for OutfitRecommendationSection to pick up.
        if (
            intent.kind !== "addToCart" &&
            intent.kind !== "buyNow" &&
            intent.kind !== "sendToChat"
        ) {
            return;
        }
        replayedRef.current = true;
        clearAuthIntent();
        console.log("[ProductInfo] Replaying intent:", intent);

        if (intent.kind === "addToCart") {
            const variant = variants.find((v) => v.id === intent.variantId);
            if (!variant) {
                toast.error("Sản phẩm không còn khả dụng");
                return;
            }
            void performAddToCart(intent.variantId, intent.quantity, true);
        } else if (intent.kind === "buyNow") {
            performBuyNow(intent.buyNow);
        } else if (intent.kind === "sendToChat") {
            performSendToChat(intent.attachment);
        }
    }, [session, productId, variants, performAddToCart, performBuyNow, performSendToChat]);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success("Đã sao chép liên kết vào clipboard");
        } catch {
            toast.error("Không thể sao chép liên kết");
        }
    };

    // Handle size selection - color will auto-adjust via useEffect
    const handleSizeSelect = (size: string) => {
        if (availableSizes.has(size)) {
            setSelectedSize(size);
        }
    };

    // Handle color selection by colorId
    const handleColorSelect = (colorId: number) => {
        if (availableColorIds.has(colorId)) {
            setSelectedColorId(colorId);
            onColorChange?.(colorId);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Brand */}
            <div className="text-sm text-gray-600 uppercase tracking-wider">{brand}</div>

            {/* Title & Favorite */}
            <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-black">{name}</h1>
                <Button variant="ghost" size="icon" aria-label="Add to favorites">
                    <i className="far fa-heart text-xl" />
                </Button>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-yellow-500">
                    {[...Array(5)].map((_, i) => (
                        <i key={i} className={i < Math.floor(rating) ? "fas fa-star" : "far fa-star"} />
                    ))}
                </div>
                <span className="text-sm text-gray-600">({reviewCount})</span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-black">{displayPrice.toLocaleString('vi-VN')} ₫</div>
                {originalPrice && (
                    <>
                        <div className="text-lg text-gray-400 line-through">{originalPrice.toLocaleString('vi-VN')} ₫</div>
                        {discount && (
                            <div className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded">
                                Giảm {discount}%
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Viewers */}
            {viewersCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <i className="far fa-eye" />
                    <span>{viewersCount} people are viewing this right now</span>
                </div>
            )}

            {/* Stock */}
            <div className="text-sm text-gray-600">
                {displayStock > 0 ? (
                    <>Chỉ còn <span className="text-red-600 font-semibold">{displayStock}</span> sản phẩm trong kho!</>
                ) : (
                    <span className="text-red-600 font-semibold">Hết hàng</span>
                )}
            </div>

            {/* Size selector */}
            {allSizes.length > 0 && (
            <div>
                <div className="text-sm font-semibold text-black mb-2">
                    Size: {selectedSize || "Chọn size"}
                </div>
                <div className="flex flex-wrap gap-2">
                    {allSizes.map((size) => {
                        const isAvailable = availableSizes.has(size);
                        const isSelected = selectedSize === size;

                        return (
                            <Button
                                key={size}
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => handleSizeSelect(size)}
                                disabled={!isAvailable}
                                className={`px-4 py-2 text-sm font-medium ${
                                    isSelected
                                        ? "bg-black text-white border-black"
                                        : isAvailable
                                            ? "bg-white text-black border-gray-300 hover:border-black"
                                            : "bg-gray-100 text-gray-400 border-gray-200"
                                }`}
                            >
                                {size}
                            </Button>
                        );
                    })}
                </div>
            </div>
            )}

            {/* Color selector */}
            {allColorIds.length > 0 && (
            <div>
                <div className="text-sm font-semibold text-black mb-2">
                    Màu: {selectedColorId ? colorMap.get(selectedColorId)?.name ?? "Không rõ" : "Chọn màu"}
                </div>
                <div className="flex flex-wrap gap-3">
                    {allColorIds.map((cId) => {
                        const colorEntity = colorMap.get(cId);
                        if (!colorEntity) return null;
                        const isAvailable = availableColorIds.has(cId);
                        const isSelected = selectedColorId === cId;

                        return (
                            <Button
                                key={cId}
                                variant="ghost"
                                onClick={() => handleColorSelect(cId)}
                                disabled={!isAvailable}
                                className={`relative p-0 h-auto ${!isAvailable ? 'opacity-40' : ''}`}
                                title={colorEntity.name}
                            >
                                <ColorSwatch
                                    color={colorEntity.hexCode}
                                    variant={isSelected ? "clicked-lg" : "large"}
                                    onClick={() => {}}
                                />
                                {!isAvailable && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-full h-0.5 bg-gray-400 rotate-45 transform origin-center"></div>
                                    </div>
                                )}
                            </Button>
                        );
                    })}
                </div>
            </div>
            )}

            {/* Quantity & Add to cart */}
            <div className="flex flex-wrap gap-3">
                <div className="flex items-center border border-gray-300 shrink-0">
                    <Button
                        variant="ghost"
                        onClick={decrementQty}
                        className="px-4 py-3 h-auto"
                        aria-label="Decrease quantity"
                    >
                        -
                    </Button>
                    <Input
                        type="text"
                        value={quantity}
                        readOnly
                        className="w-16 text-center py-3 h-auto border-x border-y-0 border-gray-300 shadow-none focus-visible:ring-0"
                    />
                    <Button
                        variant="ghost"
                        onClick={incrementQty}
                        className="px-4 py-3 h-auto"
                        aria-label="Increase quantity"
                    >
                        +
                    </Button>
                </div>
                <Button
                    variant="outline"
                    className="flex-1 min-w-[140px] py-3 px-4 sm:px-6 h-auto font-semibold border-black text-black hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                    disabled={!selectedVariant || displayStock === 0 || isLoading}
                    onClick={handleAddToCart}
                >
                    {isLoading ? "Đang thêm..." : displayStock === 0 ? "Hết hàng" : "Thêm vào giỏ"}
                </Button>
                <Button
                    className="flex-1 min-w-[140px] bg-black text-white py-3 px-4 sm:px-6 h-auto font-semibold hover:bg-gray-800 cursor-pointer whitespace-nowrap"
                    disabled={!selectedVariant || displayStock === 0 || isLoading}
                    onClick={handleBuyNow}
                >
                    Mua ngay
                </Button>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <Button variant="outline" className="py-3 h-auto border-gray-300 cursor-pointer" onClick={handleSendToChat}>
                    <MessageSquare size={15} />
                    Gửi qua chat
                </Button>
                <Button variant="outline" className="py-3 h-auto border-gray-300 cursor-pointer" onClick={handleShare}>
                    <i className="fas fa-share-alt" />
                    Chia sẻ
                </Button>
            </div>

        </div>
    );
}
