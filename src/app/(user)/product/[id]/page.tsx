import { notFound } from "next/navigation";
import { auth } from "@/auth";
import Header from "@/components/header/Navbar";
import ProductDetailClient from "@/components/product/ProductDetailClient";
import ReviewSection from "@/components/product/ReviewSection";
import OutfitRecommendationSection from "@/components/product/OutfitRecommendationSection";
import { productService } from "@/services/product";
import { colorService } from "@/services/color";
import type { ReviewDto } from "@/dto/product-detail";
import type { ProductDto } from "@/dto/product";
import type { ProductVariantEntity } from "@/dto/product-variant";
import type { ColorEntity } from "@/dto/color";

// Helper to calculate average rating
function calculateAverageRating(reviews: ReviewDto[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal
}

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  // Get session for access token
  const session = await auth();
  const accessToken = session?.user?.access_token;

  // Fetch product data in parallel
  let product: ProductDto | null = null;
  let variants: ProductVariantEntity[] = [];
  let reviews: ReviewDto[] = [];
  let colors: ColorEntity[] = [];

  try {
    console.log(`[ProductDetail] Fetching data for product ${id}`);

    const [productRes, variantsRes, reviewsRes, colorsRes] = await Promise.all([
      productService.getProductById(id, accessToken),
      productService.getProductVariants(id, accessToken),
      productService.getProductReviews(id, accessToken),
      colorService.getAllColors(),
    ]);

    console.log("[ProductDetail] Product response:", productRes);
    console.log("[ProductDetail] Variants response:", variantsRes);
    console.log("[ProductDetail] Reviews response:", reviewsRes);
    console.log("[ProductDetail] Colors response:", colorsRes);

    product = productRes?.data || null;
    variants = Array.isArray(variantsRes?.data) ? variantsRes.data : [];
    reviews = Array.isArray(reviewsRes?.data) ? reviewsRes.data : [];
    colors = Array.isArray(colorsRes?.data) ? colorsRes.data : [];
  } catch (error) {
    console.error("[ProductDetail] Failed to fetch product data:", error);
  }

  // If product not found, show 404
  if (!product) {
    notFound();
  }

  // Calculate average rating and review count
  const averageRating = calculateAverageRating(reviews);
  const reviewCount = reviews.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6 pt-[calc(var(--header-h)_+_1.5rem)]">
        <ProductDetailClient
          productId={product.id}
          brand={product.name.split(" ")[0] || "Brand"}
          name={product.name}
          rating={averageRating}
          reviewCount={reviewCount}
          basePrice={product.price}
          baseStock={product.stock}
          productImageUrl={product.media?.[0]?.url ?? ""}
          variantsWithMedia={product.productVariants ?? []}
          variants={variants}
          colors={colors}
        />

        {/* Outfit Recommendation Section */}
        {variants.length > 0 && (
          <OutfitRecommendationSection variantId={variants[0].id} />
        )}

        {/* Review Section */}
        <ReviewSection
          productId={product.id}
          initialReviews={reviews}
          variants={variants}
          currentUserId={session?.user?.id ? parseInt(session.user.id, 10) : undefined}
          accessToken={accessToken}
        />
      </main>
    </div>
  );
}
