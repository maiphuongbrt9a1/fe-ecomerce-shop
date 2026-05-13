import { Suspense } from "react";
import Header from "@/components/header/Navbar";
import SearchPageClient from "@/components/search/SearchPageClient";
import { categoryService } from "@/services/category";
import { colorService } from "@/services/color";
import type { CategoryDto } from "@/dto/category";
import type { ColorEntity } from "@/dto/color";

export default async function SearchPage() {
  let categories: CategoryDto[] = [];
  let colors: ColorEntity[] = [];

  try {
    const [categoriesRes, colorsRes] = await Promise.all([
      categoryService.getAllCategories(),
      colorService.getAllColors(),
    ]);
    if (Array.isArray(categoriesRes?.data)) categories = categoriesRes.data;
    if (Array.isArray(colorsRes?.data)) colors = colorsRes.data;
  } catch (error) {
    console.error("[SearchPage] Failed to fetch sidebar data:", error);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-3 py-6 md:px-6 pt-[calc(var(--header-h)_+_1.5rem)]">
        <Suspense fallback={null}>
          <SearchPageClient categories={categories} colors={colors} />
        </Suspense>
      </main>
    </div>
  );
}
