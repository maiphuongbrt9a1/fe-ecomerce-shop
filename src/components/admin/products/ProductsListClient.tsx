"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
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
import type { ProductDto } from "@/dto/product";
import type { CategoryDto } from "@/dto/category";
import ProductForm from "@/app/admin/products/_components/ProductForm";
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

const ROW_HEIGHT = 57;
const PER_PAGE = 20;

interface ProductsListClientProps {
  stockOnlyEdit?: boolean;
}

function ProductsListContent({ stockOnlyEdit = false }: ProductsListClientProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const accessToken = session?.user?.access_token || "";

  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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

  const fetchAllProducts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setProducts([]);
    const all: ProductDto[] = [];
    let page = 1;
    try {
      while (true) {
        console.log("[ProductList] Fetching products page:", page);
        const res = await productService.getAllProducts({ page, perPage: PER_PAGE, accessToken });
        const data = res.data ?? [];
        console.log("[ProductList] Page", page, "→", data.length, "items");
        if (data.length === 0) break;
        all.push(...data);
        if (page === 1) {
          setProducts(all.slice());
          setLoading(false);
          setLoadingMore(true);
        } else {
          setProducts(all.slice());
        }
        if (data.length < PER_PAGE) break;
        page += 1;
      }
      console.log("[ProductList] Done. Total:", all.length);
    } catch (err) {
      console.log("[ProductList] Error fetching products:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [accessToken]);

  const fetchProductsByCategory = useCallback(
    async (categoryId: number) => {
      setLoading(true);
      try {
        console.log("[ProductList] Fetching products for category:", categoryId);
        const res = await categoryService.getProductsByCategory(categoryId, { page: 1, perPage: 100 }, accessToken);
        setProducts(res.data ?? []);
      } catch (err) {
        console.log("[ProductList] Error fetching category products:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const fetchCategories = useCallback(async () => {
    try {
      const res = await categoryService.getAllCategories(accessToken);
      setCategories(res.data ?? []);
    } catch (err) {
      console.log("[ProductList] Error fetching categories:", err);
      setCategories([]);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) fetchCategories();
  }, [accessToken, fetchCategories]);

  useEffect(() => {
    if (!accessToken) return;
    if (activeCategoryId !== null) {
      fetchProductsByCategory(activeCategoryId);
    } else {
      fetchAllProducts();
    }
  }, [accessToken, activeCategoryId, fetchAllProducts, fetchProductsByCategory]);

  const handleProductSaved = useCallback(() => {
    setProductModalOpen(false);
    setEditingProductId(null);
    fetchAllProducts();
  }, [fetchAllProducts]);

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
      console.log("[ProductList] Error deleting product:", err);
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

  const isVoucherActive = (p: ProductDto): boolean => {
    if (!p.voucherId || !p.voucher) return false;
    if (!p.voucher.isActive) return false;
    const now = Date.now();
    return now >= new Date(p.voucher.validFrom).getTime() && now <= new Date(p.voucher.validTo).getTime();
  };

  const filteredProducts = products.filter((p) => {
    if (activeTab === "out_of_stock") return p.stock === 0;
    if (activeTab === "on_sale") return isVoucherActive(p);
    return true;
  });

  const searchedProducts = searchQuery
    ? filteredProducts.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredProducts;

  const rowVirtualizer = useVirtualizer({
    count: searchedProducts.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const gridCols = stockOnlyEdit
    ? "48px 2fr 1fr 120px 80px 80px 110px"
    : "48px 2fr 1fr 120px 80px 80px 110px 88px";

  return (
    <div className="h-screen p-6 flex flex-col overflow-hidden">
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
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#151515]">Danh sách sản phẩm</h1>
        {!stockOnlyEdit && (
          <Button onClick={openCreateModal} className="gap-2 cursor-pointer">
            <PlusSquare size={18} />
            Thêm sản phẩm
          </Button>
        )}
      </div>

      {/* Category Chips */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 overflow-x-auto pb-1">
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

      {/* Product Table Card */}
      <div className="bg-white shadow rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
            <TabsList className="bg-[var(--admin-green-light)]">
              <TabsTrigger value="all" className="cursor-pointer">Tất cả sản phẩm</TabsTrigger>
              <TabsTrigger value="on_sale" className="cursor-pointer">Đang giảm giá</TabsTrigger>
              <TabsTrigger value="out_of_stock" className="cursor-pointer">Hết hàng</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-100 text-sm w-56"
            />
          </div>
        </div>

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
          ) : searchedProducts.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Không tìm thấy sản phẩm nào</div>
          ) : (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const product = searchedProducts[virtualRow.index];
                const imgUrl = getProductImage(product);
                return (
                  <div
                    key={product.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    onClick={() => openEditModal(product.id)}
                    className="grid border-t border-gray-100 hover:bg-gray-50 cursor-pointer items-center"
                    style={{
                      gridTemplateColumns: gridCols,
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-3 py-3 text-sm text-gray-500">{virtualRow.index + 1}</div>
                    <div className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 border border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden rounded-md">
                          {imgUrl ? (
                            <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/no-image.jpg"; }} />
                          ) : (
                            <div className="w-full h-full bg-gray-200" />
                          )}
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

      {/* Product modal */}
      <Dialog open={productModalOpen} onOpenChange={(open) => { if (!open) { setProductModalOpen(false); setEditingProductId(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0" style={{ maxWidth: "95vw", width: "1400px" }}>
          <DialogHeader className="px-6 pt-6 pb-2">
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
