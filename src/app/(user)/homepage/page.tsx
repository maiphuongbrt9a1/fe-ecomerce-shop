import Header from "@/components/header/Navbar";
import HeroBanner from "@/components/home/HeroBanner";
import ProductGrid from "@/components/product/ProductGrid";
import { productService } from "@/services/product";
import { colorService } from "@/services/color";
import { auth } from "@/auth";
import type { ProductDto } from "@/dto/product";
import type { ColorEntity } from "@/dto/color";

export default async function HomePage() {
  // Get session for access token
  const session = await auth();
  const accessToken = session?.user?.access_token;

  // Fetch first page of products from API (SSR)
  let initialProducts: ProductDto[] = [];
  let initialPage = 1;
  let initialHasMore = false;
  let colors: ColorEntity[] = [];

  try {
    console.log("[HomePage] Fetching initial products and colors");
    const [productsRes, colorsRes] = await Promise.all([
      productService.getAllProducts({ page: 1, perPage: 20 }),
      colorService.getAllColors(),
    ]);
    console.log("[HomePage] Products API response:", productsRes);
    console.log("[HomePage] Colors API response:", colorsRes);

    // Backend returns products directly in data array (no pagination meta)
    if (productsRes?.data && Array.isArray(productsRes.data)) {
      initialProducts = productsRes.data;
      initialPage = 1;
      initialHasMore = initialProducts.length === 20;
      console.log(
        "[HomePage] Loaded",
        initialProducts.length,
        "products; hasMore:",
        initialHasMore,
      );
    }

    if (colorsRes?.data && Array.isArray(colorsRes.data)) {
      colors = colorsRes.data;
      console.log("[HomePage] Loaded", colors.length, "colors");
    }
  } catch (error) {
    console.error("[HomePage] Failed to fetch products/colors:", error);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6 pt-[calc(var(--header-h)_+_1.5rem)]">
        {/* Hero Banner */}
        <HeroBanner />

        {/* Section Divider */}
        <div className="relative my-8 md:my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-6 text-sm font-medium tracking-wider text-gray-700 uppercase">
              GỢI Ý HÔM NAY
            </span>
          </div>
        </div>

        {/* Product Grid with Infinite Scroll */}
        <ProductGrid
          initialProducts={initialProducts}
          initialPage={initialPage}
          initialHasMore={initialHasMore}
          colors={colors}
        />
      </main>
    </div>
  );
}
