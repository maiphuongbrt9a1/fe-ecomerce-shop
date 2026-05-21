"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Search,
  PlusSquare,
  Pencil,
  Trash2,
  Plus,
  X,
  Filter,
  Loader2,
} from "lucide-react";
import { productService } from "@/services/product";
import { categoryService } from "@/services/category";
import { useDebounce } from "@/hooks/useDebounce";
import type { ProductDto } from "@/dto/product";
import type { CategoryDto } from "@/dto/category";
import ProductForm from "@/app/admin/products/_components/ProductForm";
import ProductVariantsTable from "@/components/admin/products/ProductVariantsTable";
import RowImage from "@/components/RowImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type FilterTab = "all" | "on_sale" | "out_of_stock";
type ViewMode = "products" | "variants";

const ROW_HEIGHT = 57;
const PER_PAGE = 20;

interface ProductsListClientProps {
  stockOnlyEdit?: boolean;
}

// Maps the UI tab to the BE filter flags so resetAndFetch stays declarative.
const tabToFilters = (tab: FilterTab): { inStock?: boolean; onSale?: boolean } => {
  if (tab === "out_of_stock") return { inStock: false };
  if (tab === "on_sale") return { onSale: true };
  return {};
};

function ProductsListContent({ stockOnlyEdit = false }: ProductsListClientProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = session?.user?.access_token || "";

  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "variants" ? "variants" : "products"
  );

  const handleViewChange = (next: ViewMode) => {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "variants") {
      params.set("view", "variants");
    } else {
      params.delete("view");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const openCreateModal = () => {
    setEditingProductId(null);
    setProductModalOpen(true);
  };

  const openEditModal = (id: number) => {
    setEditingProductId(id);
    setProductModalOpen(true);
  };

  const urlCategoryId = searchParams.get("categoryId");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(
    urlCategoryId ? parseInt(urlCategoryId) : null
  );

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Server-side filtering + pagination. The active filter snapshot lives in a
  // ref so fetchMore always pulls the next page with the same filters that
  // started the current set — independent of what's been typed/clicked since.
  const debouncedSearch = useDebounce(searchQuery, 300);
  const requestTokenRef = useRef(0);
  const pageRef         = useRef(1);
  const activeFiltersRef = useRef<{
    search: string;
    categoryId: number | null;
    tab: FilterTab;
  }>({ search: "", categoryId: null, tab: "all" });

  const resetAndFetch = useCallback(
    async (search: string, categoryId: number | null, tab: FilterTab) => {
      if (!accessToken) return;
      const token = ++requestTokenRef.current;
      activeFiltersRef.current = { search, categoryId, tab };
      setLoading(true);
      setLoadingMore(false);
      setProducts([]);
      pageRef.current = 1;
      setHasMore(true);
      try {
        const res = await productService.getAllProducts({
          page: 1,
          perPage: PER_PAGE,
          search,
          categoryId: categoryId ?? undefined,
          ...tabToFilters(tab),
          accessToken,
        });
        if (token !== requestTokenRef.current) return;
        const data = res.data ?? [];
        setProducts(data);
        setHasMore(data.length > 0);
      } catch (err) {
        console.error("[ProductList] reset fetch error:", err);
      } finally {
        if (token === requestTokenRef.current) setLoading(false);
      }
    },
    [accessToken]
  );

  const fetchMore = useCallback(async () => {
    if (!accessToken) return;
    const token = requestTokenRef.current;
    const nextPage = pageRef.current + 1;
    const { search, categoryId, tab } = activeFiltersRef.current;
    setLoadingMore(true);
    try {
      const res = await productService.getAllProducts({
        page: nextPage,
        perPage: PER_PAGE,
        search,
        categoryId: categoryId ?? undefined,
        ...tabToFilters(tab),
        accessToken,
      });
      if (token !== requestTokenRef.current) return;
      const data = res.data ?? [];
      if (data.length > 0) {
        setProducts((prev) => [...prev, ...data]);
        pageRef.current = nextPage;
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("[ProductList] fetchMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await categoryService.getAllCategories(accessToken);
      setCategories(res.data ?? []);
    } catch (err) {
      console.error("[ProductList] fetchCategories error:", err);
      setCategories([]);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) fetchCategories();
  }, [accessToken, fetchCategories]);

  // Any filter change (search / category / tab) resets to page 1 server-side.
  useEffect(() => {
    if (!accessToken) return;
    resetAndFetch(debouncedSearch, activeCategoryId, activeTab);
  }, [accessToken, debouncedSearch, activeCategoryId, activeTab, resetAndFetch]);

  const handleProductSaved = useCallback(() => {
    setProductModalOpen(false);
    setEditingProductId(null);
    resetAndFetch(debouncedSearch, activeCategoryId, activeTab);
  }, [resetAndFetch, debouncedSearch, activeCategoryId, activeTab]);

  const handleCategoryClick = (categoryId: number) => {
    setActiveCategoryId(activeCategoryId === categoryId ? null : categoryId);
  };

  const clearCategoryFilter = () => setActiveCategoryId(null);

  const handleDelete = async (id: number) => {
    try {
      console.log("[ProductList] Deleting product:", id);
      await productService.deleteProduct(id, accessToken);
      setDeleteConfirmId(null);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("[ProductList] Delete error:", err);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !session?.user?.id) return;
    setCategorySaving(true);
    try {
      await categoryService.createCategory(
        {
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim() || newCategoryName.trim(),
          createByUserId: parseInt(session.user.id),
        },
        accessToken
      );
      setAddCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryDesc("");
      toast.success("Tạo danh mục thành công");
      await fetchCategories();
    } catch (err) {
      console.error("[ProductList] Error creating category:", err);
      toast.error("Tạo danh mục thất bại");
    } finally {
      setCategorySaving(false);
    }
  };

  const getCategoryName = (categoryId: number | null): string => {
    if (!categoryId) return "--";
    return categories.find((c) => c.id === categoryId)?.name ?? "--";
  };

  const getProductImage = (product: ProductDto): string | null => {
    if (product.media && product.media.length > 0) return product.media[0].url;
    if (product.productVariants?.length && product.productVariants[0].media?.length) {
      return product.productVariants[0].media[0].url;
    }
    return null;
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (index) => products[index]?.id ?? index,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= products.length - 5 && hasMore && !loadingMore && !loading) {
      fetchMore();
    }
  }, [virtualItems, products.length, hasMore, loadingMore, loading, fetchMore]);

  const gridCols = stockOnlyEdit
    ? "48px 2fr 1fr 120px 80px 80px 110px"
    : "48px 2fr 1fr 120px 80px 80px 110px 88px";

  return (
    <div className="h-screen p-3 sm:p-4 md:p-6 flex flex-col overflow-hidden">
      {/* Delete Confirmation Dialog */}
      {!stockOnlyEdit && deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--admin-green-dark)] mb-2">Xác nhận xóa</h3>
            <p className="text-gray-600 mb-4">Bạn có chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="cursor-pointer">Hủy</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirmId)} className="cursor-pointer">Xóa</Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-[#151515]">Danh sách sản phẩm</h1>
        {!stockOnlyEdit && (
          <Button onClick={openCreateModal} className="gap-2 cursor-pointer">
            <PlusSquare size={18} />
            Thêm sản phẩm
          </Button>
        )}
      </div>

      {/* Product Table Card */}
      <div className="bg-white shadow rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* View switcher — products vs variants */}
        <div className="px-3 sm:px-4 pt-3 flex-shrink-0">
          <Tabs value={view} onValueChange={(v) => handleViewChange(v as ViewMode)}>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="bg-[var(--admin-green-light)] w-max">
                <TabsTrigger value="products" className="cursor-pointer">Sản phẩm</TabsTrigger>
                <TabsTrigger value="variants" className="cursor-pointer">Biến thể sản phẩm</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {/* Category Chips — only in the products view, kept inside the card so the
            switcher position doesn't shift when toggling views. */}
        {view === "products" && (
          <div className="flex items-center gap-2 px-3 sm:px-4 pt-3 flex-shrink-0 overflow-x-auto pb-1">
            {!stockOnlyEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddCategoryOpen(true)}
                className="flex-shrink-0 gap-1.5 cursor-pointer border-dashed"
              >
                <Plus size={14} />
                Thêm
              </Button>
            )}
            {activeCategoryId !== null && (
              <Button variant="ghost" size="sm" onClick={clearCategoryFilter} className="flex-shrink-0 gap-1 cursor-pointer">
                <X size={12} />
                Bỏ lọc
              </Button>
            )}
            {categories.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={activeCategoryId === cat.id ? "default" : "outline"}
                onClick={() => handleCategoryClick(cat.id)}
                className="flex-shrink-0 cursor-pointer"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 sm:px-4 pt-3 pb-2 flex-shrink-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="bg-[var(--admin-green-light)] w-max">
                <TabsTrigger value="all" className="cursor-pointer">
                  {view === "variants" ? "Tất cả biến thể" : "Tất cả sản phẩm"}
                </TabsTrigger>
                <TabsTrigger value="on_sale" className="cursor-pointer">Đang giảm giá</TabsTrigger>
                <TabsTrigger value="out_of_stock" className="cursor-pointer">Hết hàng</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
          <div className="relative w-full md:w-auto">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-100 text-sm w-full md:w-56"
            />
          </div>
        </div>

        {view === "variants" ? (
          <ProductVariantsTable
            stockOnlyEdit={stockOnlyEdit}
            searchQuery={searchQuery}
            inStock={tabToFilters(activeTab).inStock}
            onSale={tabToFilters(activeTab).onSale}
            accessToken={accessToken}
            onEditVariant={openEditModal}
          />
        ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
          <div className="min-w-[1000px] flex flex-col flex-1 min-h-0">
        {/* Table Header */}
        <div className="grid bg-[var(--admin-green-light)] flex-shrink-0" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">STT</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Sản phẩm</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">
            <div className="flex items-center gap-1">
              Danh mục
              {activeCategoryId !== null ? (
                <button onClick={clearCategoryFilter} className="p-0.5 hover:bg-white/50 cursor-pointer" title="Xóa bộ lọc danh mục">
                  <Filter size={14} className="text-[var(--admin-green-dark)]" />
                </button>
              ) : (
                <Filter size={14} className="text-gray-400" />
              )}
            </div>
          </div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Giá từ</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Tồn kho</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Biến thể</div>
          <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Ngày thêm</div>
          {!stockOnlyEdit && (
            <div className="px-3 py-3 text-sm font-semibold text-[var(--admin-green-dark)]">Hành động</div>
          )}
        </div>

        {/* Virtualized body */}
        <div ref={tableContainerRef} className="overflow-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Đang tải...</div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Không tìm thấy sản phẩm nào</div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const product = products[virtualRow.index];
                const imgUrl = getProductImage(product);
                return (
                  <div
                    key={product.id}
                    onClick={() => openEditModal(product.id)}
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
                    <div className="px-3 py-3 text-sm text-gray-500">{virtualRow.index + 1}</div>
                    <div className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 border border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden rounded-md">
                          <RowImage src={imgUrl} alt={product.name} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-gray-400 truncate">{product.stockKeepingUnit}</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-3 text-sm text-gray-600">{getCategoryName(product.categoryId)}</div>
                    <div className="px-3 py-3 text-sm font-medium text-gray-800">{product.price.toLocaleString("vi-VN")}₫</div>
                    <div className="px-3 py-3">
                      <span className={`text-sm font-medium ${product.stock === 0 ? "text-red-500" : "text-gray-800"}`}>
                        {product.stock}
                      </span>
                    </div>
                    <div className="px-3 py-3 text-sm text-gray-600">{product.productVariants?.length ?? 0}</div>
                    <div className="px-3 py-3 text-sm text-gray-500">{formatDate(product.createdAt)}</div>
                    {!stockOnlyEdit && (
                      <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(product.id)} className="cursor-pointer" title="Chỉnh sửa">
                            <Pencil size={16} className="text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(product.id)} className="cursor-pointer hover:bg-red-50" title="Xóa">
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        </div>
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
        )}
      </div>

      {/* Product modal */}
      <Dialog open={productModalOpen} onOpenChange={(open) => { if (!open) { setProductModalOpen(false); setEditingProductId(null); } }}>
        <DialogContent className="w-[95vw] !max-w-[min(95vw,1400px)] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2 min-w-0">
            <DialogTitle>
              {editingProductId
                ? stockOnlyEdit ? "Cập nhật tồn kho" : "Chỉnh sửa sản phẩm"
                : "Thêm sản phẩm mới"}
            </DialogTitle>
          </DialogHeader>
          {productModalOpen && (
            <ProductForm
              productId={editingProductId ?? undefined}
              onSuccess={handleProductSaved}
              onCancel={() => { setProductModalOpen(false); setEditingProductId(null); }}
              stockOnly={stockOnlyEdit && !!editingProductId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      {!stockOnlyEdit && (
        <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Thêm danh mục mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Tên danh mục</Label>
                <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="VD: Áo thun, Giày dép, ..." />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">Mô tả</Label>
                <Input value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} placeholder="Mô tả ngắn về danh mục" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddCategoryOpen(false)} className="cursor-pointer">Hủy</Button>
              <Button type="button" onClick={handleAddCategory} disabled={categorySaving || !newCategoryName.trim()} className="cursor-pointer">
                {categorySaving ? "Đang tạo..." : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function ProductsListClient(props: ProductsListClientProps) {
  return (
    <Suspense fallback={null}>
      <ProductsListContent {...props} />
    </Suspense>
  );
}
