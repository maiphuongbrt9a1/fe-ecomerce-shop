"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import ProductCard from "@/components/product/ProductCard";
import { recommendationService } from "@/services/recommendation";
import { productService } from "@/services/product";
import { colorService } from "@/services/color";
import { cartService } from "@/services/cart";
import { useCart } from "@/components/cart/CartContext";
import { ApiError } from "@/utils/api-error";
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

  const getOrCreateCartId = async (userId: number, token: string): Promise<number> => {
    try {
      const cartRes = await cartService.getCartById(userId, token);
      return cartRes.data!.id;
    } catch (err) {
      if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 400)) {
        const createRes = await cartService.createCart(userId, { userId }, token);
        if (!createRes.data?.id) throw new Error("Không thể tạo giỏ hàng");
        return createRes.data.id;
      }
      throw err;
    }
  };

  const handleAddToCart = async (variant: ProductVariantWithMediaEntity) => {
    if (!session?.user?.id || !session?.user?.access_token) {
      router.push("/auth/login");
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

  const handleAddAllToCart = async () => {
    if (!session?.user?.id || !session?.user?.access_token) {
      router.push("/auth/login");
      return;
    }

    const inStockItems = items.filter((item) => item.productStock > 0);
    if (inStockItems.length === 0) return;

    setAddingAll(true);
    const userId = parseInt(session.user.id, 10);
    const token = session.user.access_token;

    try {
      const cartId = await getOrCreateCartId(userId, token);
      await Promise.all(
        inStockItems.map((item) =>
          cartService.createCartItem(userId, { cartId, productVariantId: item.variant.id, quantity: 1 }, token)
        )
      );
      await refreshCart();
      toast.success(`Đã thêm ${inStockItems.length} sản phẩm vào giỏ hàng`);
    } catch (err) {
      console.error("[OutfitRecommendationSection] Add all to cart failed:", err);
      toast.error("Thêm vào giỏ hàng thất bại");
    } finally {
      setAddingAll(false);
    }
  };

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
        {items.map((item) => (
          <div key={item.variant.id} className="flex flex-col">
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
        <div className="flex flex-col">
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
