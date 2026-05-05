"use client";

import { useState, useMemo, useCallback } from "react";
import ProductGallery from "./ProductGallery";
import ProductInfo from "./ProductInfo";
import type { ProductVariantWithMediaEntity } from "@/dto/product";
import type { ProductVariantEntity } from "@/dto/product-variant";
import type { ColorEntity } from "@/dto/color";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80";

interface ProductDetailClientProps {
  productId: number;
  brand: string;
  name: string;
  rating: number;
  reviewCount: number;
  basePrice: number;
  baseStock: number;
  productImageUrl: string;
  /** Variants with media (from product response) */
  variantsWithMedia: ProductVariantWithMediaEntity[];
  /** Variants without media (from separate endpoint) — used for ProductInfo logic */
  variants: ProductVariantEntity[];
  colors: ColorEntity[];
}

export default function ProductDetailClient({
  productId,
  brand,
  name,
  rating,
  reviewCount,
  basePrice,
  baseStock,
  productImageUrl,
  variantsWithMedia,
  variants,
  colors,
}: ProductDetailClientProps) {
  /**
   * Build the full image list:
   * [product main image, ...first image of each unique color variant]
   * Also build a map: colorId → index in allImages
   */
  const { allImages, colorImageIndexMap } = useMemo(() => {
    const images: string[] = [];
    const indexMap = new Map<number, number>();

    // Product main image first
    images.push(productImageUrl || PLACEHOLDER_IMAGE);

    // One image per unique color (pick first variant that has an image)
    const seenColors = new Set<number>();
    for (const v of variantsWithMedia) {
      if (seenColors.has(v.colorId)) continue;
      const url = v.media?.find((m) => m.type === "IMAGE")?.url;
      if (url) {
        seenColors.add(v.colorId);
        indexMap.set(v.colorId, images.length);
        images.push(url);
      }
    }

    return { allImages: images, colorImageIndexMap: indexMap };
  }, [productImageUrl, variantsWithMedia]);

  // The gallery index to jump to when a color is selected
  const [galleryIndex, setGalleryIndex] = useState(0);

  const handleColorChange = useCallback((colorId: number) => {
    const idx = colorImageIndexMap.get(colorId);
    if (idx !== undefined) setGalleryIndex(idx);
  }, [colorImageIndexMap]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
      <ProductGallery images={allImages} forcedIndex={galleryIndex} />
      <ProductInfo
        productId={productId}
        productImageUrl={productImageUrl}
        brand={brand}
        name={name}
        rating={rating}
        reviewCount={reviewCount}
        basePrice={basePrice}
        viewersCount={0}
        baseStock={baseStock}
        variants={variants}
        colors={colors}
        onColorChange={handleColorChange}
      />
    </div>
  );
}
