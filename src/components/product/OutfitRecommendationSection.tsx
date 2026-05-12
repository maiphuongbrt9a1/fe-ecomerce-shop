"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import { recommendationService } from "@/services/recommendation";
import { productService } from "@/services/product";
import { colorService } from "@/services/color";
import { cartService } from "@/services/cart";
import { useCart } from "@/components/cart/CartContext";
import { getOrCreateCartId } from "@/utils/cart-helpers";
import {
  redirectToLoginWithIntent,
  readAuthIntent,
  clearAuthIntent,
} from "@/utils/auth-intent";
import type { ProductVariantWithMediaEntity } from "@/dto/product";
import type { ColorEntity } from "@/dto/color";

interface RecommendationItem {
  productId: number;
  productName: string;
  productStock: number;
  productImageUrl: string;
  variant: ProductVariantWithMediaEntity;
}

interface Props {
  variantId: number;
}

export default function OutfitRecommendationSection({ variantId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const { refreshCart } = useCart();

  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [colors, setColors] = useState<ColorEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingVariantId, setAddingVariantId] = useState<number | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);

  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setCardHeight(entry.contentRect.height);
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [recRes, colorRes] = await Promise.all([
          recommendationService.getOutfitRecommendation(variantId),
          colorService.getAllColors(),
        ]);

        if (cancelled) return;

        const recommendedVariants = recRes?.data ?? [];
        setColors(colorRes?.data ?? []);

        if (recommendedVariants.length === 0) {
          setLoading(false);
          return;
        }

        const productResults = await Promise.all(
          recommendedVariants.map((v) => productService.getProductById(String(v.productId)))
        );

        if (!cancelled) {
          const resolved: RecommendationItem[] = [];
          for (let i = 0; i < recommendedVariants.length; i++) {
            const product = productResults[i]?.data;
            if (!product) continue;
            const recVariantId = recommendedVariants[i].id;
            const matched = product.productVariants?.find((pv) => pv.id === recVariantId);
            if (!matched) continue;
            resolved.push({
              productId: product.id,
              productName: product.name,
              productStock: matched.stock,
              productImageUrl: matched.media?.[0]?.url ?? product.media?.[0]?.url ?? "",
              variant: matched,
            });
          }
          setItems(resolved);
        }
      } catch (err) {
        console.error("[OutfitRecommendationSection] Failed to load:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [variantId]);

  const pathname = usePathname();

  const handleAddToCart = async (variant: ProductVariantWithMediaEntity) => {
    if (!session?.user?.id || !session?.user?.access_token) {
      redirectToLoginWithIntent(
        router,
        {
          kind: "addToCart",
          productId: variant.productId,
          variantId: variant.id,
          quantity: 1,
        },
        pathname || "/",
      );
      return;
    }

    setAddingVariantId(variant.id);
    const userId = parseInt(session.user.id, 10);
    const token = session.user.access_token;

    try {
      const cartId = await getOrCreateCartId(userId, token);
      await cartService.createCartItem(userId, { cartId, productVariantId: variant.id, quantity: 1 }, token);
      await refreshCart();
      toast.success("Đã thêm vào giỏ hàng");
    } catch (err) {
      console.error("[OutfitRecommendationSection] Add to cart failed:", err);
      toast.error("Thêm vào giỏ hàng thất bại");
    } finally {
      setAddingVariantId(null);
    }
  };

  // Parse the product id this recommendation section is anchored to from the
  // URL (this section only renders on /product/[id]).
  const currentProductId = (() => {
    const m = (pathname || "").match(/\/product\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })();

  const performAddAll = useCallback(
    async (variantIds: number[], navigateToCart: boolean) => {
      if (!session?.user?.id || !session?.user?.access_token) return;
      if (variantIds.length === 0) return;
      setAddingAll(true);
      const userId = parseInt(session.user.id, 10);
      const token = session.user.access_token;
      try {
        const cartId = await getOrCreateCartId(userId, token);
        // Sequential adds: backend's AddANewCart runs a heavy interactive transaction
        // (upsert + full cart re-read inside the same tx); parallel calls cause
        // transaction timeouts / pool starvation and some items silently fail.
        let added = 0;
        for (const productVariantId of variantIds) {
          try {
            await cartService.createCartItem(
              userId,
              { cartId, productVariantId, quantity: 1 },
              token,
            );
            added++;
          } catch (err) {
            console.error(
              "[OutfitRecommendationSection] Failed to add variant",
              productVariantId,
              err,
            );
          }
        }
        await refreshCart();
        if (added === variantIds.length) {
          toast.success(`Đã thêm ${added} sản phẩm vào giỏ hàng`);
        } else if (added > 0) {
          toast.warning(
            `Đã thêm ${added}/${variantIds.length} sản phẩm. Vui lòng thử lại với các sản phẩm còn lại.`,
          );
        } else {
          toast.error("Thêm vào giỏ hàng thất bại");
        }
        if (navigateToCart && added > 0) router.push("/cart");
      } catch (err) {
        console.error("[OutfitRecommendationSection] Add all to cart failed:", err);
        toast.error("Thêm vào giỏ hàng thất bại");
      } finally {
        setAddingAll(false);
      }
    },
    [session, refreshCart, router],
  );

  const handleAddAllToCart = async () => {
    const inStockItems = items.filter((item) => item.productStock > 0);
    if (inStockItems.length === 0) return;
    const variantIds = inStockItems.map((item) => item.variant.id);

    if (!session?.user?.id || !session?.user?.access_token) {
      if (currentProductId === null) {
        // Can't anchor replay; fall back to plain callbackUrl flow.
        redirectToLoginWithIntent(
          router,
          { kind: "addToCart", productId: 0, variantId: variantIds[0], quantity: 1 },
          pathname || "/",
        );
        return;
      }
      redirectToLoginWithIntent(
        router,
        {
          kind: "addAllToCart",
          productId: currentProductId,
          variantIds,
        },
        pathname || "/",
      );
      return;
    }

    await performAddAll(variantIds, false);
  };

  // Replay add-all intent once after login lands the user back here.
  const replayedRef = useRef(false);
  useEffect(() => {
    if (replayedRef.current) return;
    if (loading) return; // wait for `items` to load before replaying
    if (!session?.user?.id || !session?.user?.access_token) return;
    if (currentProductId === null) return;
    const intent = readAuthIntent();
    if (!intent) return;
    if (intent.kind !== "addAllToCart") return;
    if (intent.productId !== currentProductId) return;
    replayedRef.current = true;
    clearAuthIntent();
    console.log("[OutfitRecommendationSection] Replaying addAllToCart intent:", intent);
    void performAddAll(intent.variantIds, true);
  }, [session, loading, currentProductId, performAddAll]);

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-bold mb-6 uppercase tracking-wide">Gợi ý phối đồ</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 aspect-[4/3]" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold mb-6 uppercase tracking-wide">Gợi ý phối đồ</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item, index) => (
          <div key={item.variant.id} ref={index === 0 ? cardRef : undefined} className="flex flex-col">
            <ProductCard
              id={String(item.productId)}
              name={item.productName}
              stock={item.productStock}
              productImageUrl={item.productImageUrl}
              variants={[item.variant]}
              colors={colors}
              showVariantInfo
            />
            <button
              onClick={() => handleAddToCart(item.variant)}
              disabled={item.productStock === 0 || addingVariantId === item.variant.id}
              className="mt-1 w-full py-2 text-sm font-semibold border border-black bg-white text-black hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingVariantId === item.variant.id
                ? "Đang thêm..."
                : item.productStock === 0
                ? "Hết hàng"
                : "Thêm vào giỏ"}
            </button>
          </div>
        ))}

        {/* Add all to cart card — outline style, end of list, matches full card+button height */}
        <div className="flex flex-col" style={cardHeight > 0 ? { minHeight: cardHeight } : undefined}>
          <button
            onClick={handleAddAllToCart}
            disabled={addingAll || items.every((i) => i.productStock === 0)}
            className="flex-1 flex flex-col items-center justify-center gap-2 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="relative">
              <ShoppingCart size={40} strokeWidth={1.5} />
              <span className="absolute -top-2 -right-3 text-xl font-bold leading-none">+</span>
            </div>
            <span className="text-sm font-semibold uppercase tracking-wide text-center px-2">
              {addingAll ? "Đang thêm..." : "Thêm tất cả vào giỏ"}
            </span>
            <span className="text-xs opacity-60">{items.filter((i) => i.productStock > 0).length} sản phẩm</span>
          </button>
        </div>
      </div>
    </section>
  );
}
