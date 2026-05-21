"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Pencil, Loader2 } from "lucide-react";
import { productVariantService } from "@/services/product-variant";
import type { ProductVariantWithMediaAndProductEntity } from "@/dto/product-variant";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import RowImage from "@/components/RowImage";

const ROW_HEIGHT = 57;
const PER_PAGE = 20;

interface ProductVariantsTableProps {
  stockOnlyEdit: boolean;
  searchQuery: string;
  inStock?: boolean;
  onSale?: boolean;
  accessToken: string;
  onEditVariant: (productId: number) => void;
}

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

export default function ProductVariantsTable({
  stockOnlyEdit,
  searchQuery,
  inStock,
  onSale,
  accessToken,
  onEditVariant,
}: ProductVariantsTableProps) {
  const [variants, setVariants] = useState<ProductVariantWithMediaAndProductEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef         = useRef(1);
  const requestTokenRef = useRef(0);
  // Filter snapshot active in the current set. fetchMore uses this so the next
  // page matches whatever resetAndFetch started — independent of what the
  // controls are showing right now.
  const activeFiltersRef = useRef<{ search: string; inStock?: boolean; onSale?: boolean }>({ search: "" });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const resetAndFetch = useCallback(
    async (search: string, inStockFilter?: boolean, onSaleFilter?: boolean) => {
      if (!accessToken) return;
      const token = ++requestTokenRef.current;
      activeFiltersRef.current = { search, inStock: inStockFilter, onSale: onSaleFilter };
      setLoading(true);
      setLoadingMore(false);
      setVariants([]);
      pageRef.current = 1;
      setHasMore(true);
      try {
        const res = await productVariantService.getAllProductVariants({
          page: 1,
          perPage: PER_PAGE,
          search,
          inStock: inStockFilter,
          onSale: onSaleFilter,
          accessToken,
        });
        if (token !== requestTokenRef.current) return;
        const data = res.data ?? [];
        setVariants(data);
        setHasMore(data.length > 0);
      } catch (err) {
        console.error("[ProductVariantsTable] reset fetch error:", err);
      } finally {
        if (token === requestTokenRef.current) setLoading(false);
      }
    },
    [accessToken],
  );

  const fetchMore = useCallback(async () => {
    if (!accessToken) return;
    const token = requestTokenRef.current;
    const nextPage = pageRef.current + 1;
    const { search, inStock: inStockFilter, onSale: onSaleFilter } = activeFiltersRef.current;
    setLoadingMore(true);
    try {
      const res = await productVariantService.getAllProductVariants({
        page: nextPage,
        perPage: PER_PAGE,
        search,
        inStock: inStockFilter,
        onSale: onSaleFilter,
        accessToken,
      });
      if (token !== requestTokenRef.current) return;
      const data = res.data ?? [];
      if (data.length > 0) {
        setVariants((prev) => [...prev, ...data]);
        pageRef.current = nextPage;
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[ProductVariantsTable] fetchMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken]);

  useEffect(() => {
    resetAndFetch(debouncedSearch, inStock, onSale);
  }, [resetAndFetch, debouncedSearch, inStock, onSale]);

  const rowVirtualizer = useVirtualizer({
    count: variants.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (index) => variants[index]?.id ?? index,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= variants.length - 5 && hasMore && !loadingMore && !loading) {
      fetchMore();
    }
  }, [virtualItems, variants.length, hasMore, loadingMore, loading, fetchMore]);

  const gridCols = stockOnlyEdit
    ? "48px 64px 1.4fr 1.6fr 1fr 90px 80px 110px 90px 110px"
    : "48px 64px 1.4fr 1.6fr 1fr 90px 80px 110px 90px 110px 72px";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
      <div className="min-w-[1200px] flex flex-col flex-1 min-h-0">
        {/* Table Header */}
        <div
          className="grid bg-[var(--admin-green-light)] flex-shrink-0"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">STT</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Ảnh</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">
            Tên biến thể
          </div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">
            Sản phẩm
          </div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">SKU</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Màu</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Size</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Giá</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">
            Tồn kho
          </div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">
            Ngày thêm
          </div>
          {!stockOnlyEdit && (
            <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">
              Hành động
            </div>
          )}
        </div>

        {/* Virtualized body */}
        <div ref={tableContainerRef} className="overflow-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Đang tải...
            </div>
          ) : variants.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Không tìm thấy biến thể nào
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const variant = variants[virtualRow.index];
                const imgUrl = variant.media?.[0]?.url ?? null;
                return (
                  <div
                    key={variant.id}
                    onClick={() => onEditVariant(variant.productId)}
                    className="grid border-t border-gray-100 hover:bg-gray-50 cursor-pointer items-center"
                    style={{
                      gridTemplateColumns: gridCols,
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-3 py-3 text-sm text-gray-500">
                      {virtualRow.index + 1}
                    </div>
                    <div className="px-3 py-3">
                      <div className="w-9 h-9 border border-gray-200 bg-gray-100 flex items-center justify-center overflow-hidden rounded-md">
                        <RowImage src={imgUrl} alt={variant.variantName} />
                      </div>
                    </div>
                    <div className="px-3 py-3 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {variant.variantName}
                      </p>
                    </div>
                    <div className="px-3 py-3 min-w-0">
                      <p className="text-sm text-gray-800 truncate">
                        {variant.product.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {variant.product.stockKeepingUnit}
                      </p>
                    </div>
                    <div className="px-3 py-3 text-sm text-gray-600 truncate">
                      {variant.stockKeepingUnit}
                    </div>
                    <div className="px-3 py-3 text-sm text-gray-600">
                      {variant.variantColor}
                    </div>
                    <div className="px-3 py-3 text-sm text-gray-600">
                      {variant.variantSize}
                    </div>
                    <div className="px-3 py-3 text-sm font-medium text-gray-800">
                      {variant.price.toLocaleString("vi-VN")}₫
                    </div>
                    <div className="px-3 py-3">
                      <span
                        className={`text-sm font-medium ${variant.stock === 0 ? "text-red-500" : "text-gray-800"}`}
                      >
                        {variant.stock}
                      </span>
                    </div>
                    <div className="px-3 py-3 text-sm text-gray-500">
                      {formatDate(variant.createdAt)}
                    </div>
                    {!stockOnlyEdit && (
                      <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditVariant(variant.productId)}
                          className="cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={16} className="text-gray-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {loadingMore && (
            <div className="flex items-center justify-center py-4 gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Đang tải thêm...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
