"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, PlusSquare, Pencil, Trash2, Loader2, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { voucherService } from "@/services/voucher";
import { categoryService } from "@/services/category";
import { productService } from "@/services/product";
import { colorService } from "@/services/color";
import { userService } from "@/services/user";
import type { VoucherDto, CreateVoucherDto, DiscountType, SearchVoucherParams } from "@/dto/voucher";
import type { CategoryDto } from "@/dto/category";
import type { ProductDto } from "@/dto/product";
import type { ColorEntity } from "@/dto/color";
import type { UserDto } from "@/services/user";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

function VoucherTargetCell({ voucher }: { voucher: VoucherDto }) {
  const products = voucher.voucherForProduct ?? [];
  const categories = voucher.voucherForCategory ?? [];
  const variants = voucher.voucherForSpecialProductVariant ?? [];
  const users = voucher.userVouchers ?? [];

  const parts: React.ReactNode[] = [];
  if (variants.length > 0) parts.push(<span key="variant" className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{variants.length} phiên bản</span>);
  if (products.length > 0) parts.push(<span key="product" className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{products.length} sản phẩm</span>);
  if (categories.length > 0) parts.push(<span key="category" className="inline-flex items-center gap-1 text-xs bg-[var(--admin-green-light)] text-[var(--admin-green-dark)] px-1.5 py-0.5 rounded">{categories.length} danh mục</span>);
  if (users.length > 0) parts.push(<span key="user" className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{users.length} người dùng</span>);
  if (parts.length === 0) return <span className="text-xs text-gray-300">—</span>;
  return <div className="flex flex-wrap gap-1">{parts}</div>;
}

// Fixed row height — tall enough to fit the "Áp dụng cho" cell when it wraps
// up to 4 count badges (≈22px each + cell padding). Keeping it fixed (instead
// of measuring dynamically) means filtering/refetching never produces stale
// per-index measurements, so rows never overlap or stack jagged.
const ROW_HEIGHT = 120;
const PER_PAGE = 10;
const COLS_FULL = "48px 140px 1fr 180px 120px 100px 100px 100px 160px 96px";
const COLS_READONLY = "48px 140px 1fr 180px 120px 100px 100px 100px 160px";

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const toInputDate = (dateStr: string) => new Date(dateStr).toISOString().slice(0, 10);

type DialogMode = "create" | "edit";

interface FormState {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  validFrom: string;
  validTo: string;
  usageLimit: string;
  isActive: boolean;
  targetCategoryIds: number[];
  targetProductIds: number[];
  targetProductLabels: Record<number, string>;
  targetVariantIds: number[];
  targetVariantLabels: Record<number, string>;
  targetUserIds: number[];
  targetUserLabels: Record<number, string>;
  productSearchQuery: string;
  variantSearchQuery: string;
  userSearchQuery: string;
}

interface FilterState { discountType: DiscountType | ""; isActive: "all" | "active" | "inactive"; }

const emptyForm = (): FormState => ({
  code: "",
  description: "",
  discountType: "FIXED_AMOUNT",
  discountValue: "",
  validFrom: "",
  validTo: "",
  usageLimit: "",
  isActive: true,
  targetCategoryIds: [],
  targetProductIds: [],
  targetProductLabels: {},
  targetVariantIds: [],
  targetVariantLabels: {},
  targetUserIds: [],
  targetUserLabels: {},
  productSearchQuery: "",
  variantSearchQuery: "",
  userSearchQuery: "",
});

const emptyFilter = (): FilterState => ({ discountType: "", isActive: "all" });

const filterToParams = (search: string, filter: FilterState): SearchVoucherParams => {
  const params: SearchVoucherParams = {};
  if (search.trim()) params.code = search.trim();
  if (filter.discountType) params.discountType = filter.discountType;
  if (filter.isActive === "active") params.isActive = true;
  if (filter.isActive === "inactive") params.isActive = false;
  return params;
};

const hasActiveFilters = (filter: FilterState) => filter.discountType !== "" || filter.isActive !== "all";

interface CouponsClientProps { readonly?: boolean; }

export default function CouponsClient({ readonly = false }: CouponsClientProps) {
  const { data: session } = useSession();
  const accessToken = session?.user?.access_token || "";

  const [vouchers, setVouchers] = useState<VoucherDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<FilterState>(emptyFilter());
  const [appliedFilter, setAppliedFilter] = useState<FilterState>(emptyFilter());
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [colors, setColors] = useState<ColorEntity[]>([]);
  const [productResults, setProductResults] = useState<ProductDto[]>([]);
  const [variantResults, setVariantResults] = useState<{ id: number; variantName: string; productId: number; colorId: number; variantSize: string }[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [variantSearchLoading, setVariantSearchLoading] = useState(false);
  const productDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const variantDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User picker: virtualized, infinite-scroll, BE-side search (no client preload).
  const USER_PICKER_PAGE_SIZE = 20;
  const [pickerUsers, setPickerUsers] = useState<UserDto[]>([]);
  const [userPickerLoading, setUserPickerLoading] = useState(false);
  const [userPickerLoadingMore, setUserPickerLoadingMore] = useState(false);
  const [userPickerHasMore, setUserPickerHasMore] = useState(true);
  const userPageRef = useRef(1);
  const userRequestTokenRef = useRef(0);
  const userSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userListScrollRef = useRef<HTMLDivElement>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const colorById = useMemo(() => {
    const m: Record<number, ColorEntity> = {};
    colors.forEach((c) => { m[c.id] = c; });
    return m;
  }, [colors]);

  useEffect(() => {
    categoryService.getAllCategories().then((res) => { if (Array.isArray(res?.data)) setCategories(res.data); }).catch(() => {});
    colorService.getAllColors().then((res) => { if (Array.isArray(res?.data)) setColors(res.data); }).catch(() => {});
  }, []);

  const fetchAllVouchers = useCallback(async () => {
    setLoading(true);
    setVouchers([]);
    // Dedupe by voucher id while paginating — if the BE ever ties on its sort
    // key, the same row can appear on two pages and duplicate React keys cause
    // the rows to render on top of each other.
    const all: VoucherDto[] = [];
    const seen = new Set<number>();
    let page = 1;
    try {
      while (true) {
        console.log("[CouponsClient] Fetching vouchers page:", page);
        const res = await voucherService.getAllVouchers(page, PER_PAGE);
        const data = Array.isArray(res.data) ? res.data : [];
        if (data.length === 0) break;
        for (const v of data) {
          if (seen.has(v.id)) continue;
          seen.add(v.id);
          all.push(v);
        }
        if (page === 1) { setVouchers(all.slice()); setLoading(false); setLoadingMore(true); }
        else setVouchers(all.slice());
        if (data.length < PER_PAGE) break;
        page += 1;
      }
      console.log("[CouponsClient] Done. Total vouchers:", all.length);
    } catch (err) {
      console.error("[CouponsClient] Error:", err);
      setVouchers([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchAllVouchers(); }, [fetchAllVouchers]);

  const filteredVouchers = useMemo(() => {
    let result = vouchers;
    const q = searchInput.trim().toLowerCase();
    if (q) result = result.filter((v) => v.code.toLowerCase().includes(q) || (v.description ?? "").toLowerCase().includes(q));
    if (appliedFilter.discountType) result = result.filter((v) => v.discountType === appliedFilter.discountType);
    if (appliedFilter.isActive === "active") result = result.filter((v) => v.isActive);
    if (appliedFilter.isActive === "inactive") result = result.filter((v) => !v.isActive);
    return result;
  }, [vouchers, searchInput, appliedFilter]);

  const handleSearchChange = (value: string) => setSearchInput(value);
  const clearSearch = () => setSearchInput("");
  const applyFilters = () => { setAppliedFilter(pendingFilter); setFilterOpen(false); };
  const resetFilters = () => { const e = emptyFilter(); setPendingFilter(e); setAppliedFilter(e); setFilterOpen(false); };

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => { if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) setFilterOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  const rowVirtualizer = useVirtualizer({
    count: filteredVouchers.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    // Key measurements by the stable voucher id, not by array index. Without
    // this, filtering or refetching shifts indices and stale heights from the
    // previous ordering get applied to the new content (overlapping rows).
    getItemKey: (index) => filteredVouchers[index]?.id ?? index,
  });

  const runProductSearch = (query: string) => {
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    if (!query.trim()) { setProductResults([]); return; }
    const token = accessToken;
    productDebounceRef.current = setTimeout(async () => {
      if (!token) return;
      setProductSearchLoading(true);
      try {
        const res = await productService.getAllProducts({ page: 1, perPage: 20, accessToken: token });
        const products = Array.isArray(res?.data) ? res.data : [];
        const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
        setProductResults(filtered.slice(0, 10));
      } catch (err) { console.error("[CouponsClient] Product search error:", err); }
      finally { setProductSearchLoading(false); }
    }, 400);
  };

  const runVariantSearch = (query: string) => {
    if (variantDebounceRef.current) clearTimeout(variantDebounceRef.current);
    if (!query.trim()) { setVariantResults([]); return; }
    const token = accessToken;
    variantDebounceRef.current = setTimeout(async () => {
      if (!token) return;
      setVariantSearchLoading(true);
      try {
        const res = await productService.getAllProducts({ page: 1, perPage: 20, accessToken: token });
        const products = Array.isArray(res?.data) ? res.data : [];
        const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
        const variants = filtered.flatMap((p) => (p.productVariants ?? []).map((v) => ({ id: v.id, variantName: v.variantName, productId: p.id, colorId: v.colorId, variantSize: v.variantSize })));
        setVariantResults(variants.slice(0, 20));
      } catch (err) { console.error("[CouponsClient] Variant search error:", err); }
      finally { setVariantSearchLoading(false); }
    }, 400);
  };

  const resetUserPicker = useCallback(async (search: string) => {
    if (!accessToken) return;
    const token = ++userRequestTokenRef.current;
    setUserPickerLoading(true);
    setUserPickerLoadingMore(false);
    setPickerUsers([]);
    userPageRef.current = 1;
    setUserPickerHasMore(true);
    try {
      const res = await userService.getUsers(1, USER_PICKER_PAGE_SIZE, accessToken, search);
      if (token !== userRequestTokenRef.current) return;
      const data = Array.isArray(res?.data) ? res.data : [];
      setPickerUsers(data);
      setUserPickerHasMore(data.length > 0);
    } catch (err) {
      console.error("[CouponsClient] resetUserPicker error:", err);
    } finally {
      if (token === userRequestTokenRef.current) setUserPickerLoading(false);
    }
  }, [accessToken]);

  const fetchMoreUsers = useCallback(async (search: string) => {
    if (!accessToken) return;
    const token = userRequestTokenRef.current;
    const nextPage = userPageRef.current + 1;
    setUserPickerLoadingMore(true);
    try {
      const res = await userService.getUsers(nextPage, USER_PICKER_PAGE_SIZE, accessToken, search);
      if (token !== userRequestTokenRef.current) return;
      const data = Array.isArray(res?.data) ? res.data : [];
      if (data.length > 0) {
        setPickerUsers((prev) => [...prev, ...data]);
        userPageRef.current = nextPage;
      } else {
        setUserPickerHasMore(false);
      }
    } catch (err) {
      console.error("[CouponsClient] fetchMoreUsers error:", err);
    } finally {
      setUserPickerLoadingMore(false);
    }
  }, [accessToken]);

  const userDisplayName = (u: UserDto): string =>
    [u.lastName, u.firstName].filter(Boolean).join(" ") || u.name || u.username || `#${u.id}`;

  const openCreate = () => {
    setDialogMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setProductResults([]);
    setVariantResults([]);
    setDialogOpen(true);
    resetUserPicker("");
  };

  const openEdit = (v: VoucherDto) => {
    setDialogMode("edit");
    setEditingId(v.id);
    const productLabels: Record<number, string> = {};
    (v.voucherForProduct ?? []).forEach((p) => { productLabels[p.id] = p.name; });
    const variantLabels: Record<number, string> = {};
    (v.voucherForSpecialProductVariant ?? []).forEach((va) => {
      const colorName = colorById[va.colorId]?.name;
      const suffix = [va.variantSize, colorName].filter(Boolean).join(" · ");
      variantLabels[va.id] = suffix ? `${va.variantName} (${suffix})` : va.variantName;
    });
    // Pre-fill user chip labels straight from the voucher payload — BE includes
    // the joined user fields, so we don't need a follow-up lookup.
    const userLabels: Record<number, string> = {};
    (v.userVouchers ?? []).forEach((uv) => {
      const u = uv.user;
      const name = u
        ? [u.lastName, u.firstName].filter(Boolean).join(" ") || u.username || u.email || `#${uv.userId}`
        : `#${uv.userId}`;
      userLabels[uv.userId] = name;
    });
    setForm({
      code: v.code,
      description: v.description ?? "",
      discountType: v.discountType,
      discountValue: String(v.discountValue),
      validFrom: toInputDate(v.validFrom),
      validTo: toInputDate(v.validTo),
      usageLimit: v.usageLimit != null ? String(v.usageLimit) : "",
      isActive: v.isActive,
      targetCategoryIds: (v.voucherForCategory ?? []).map((c) => c.id),
      targetProductIds: (v.voucherForProduct ?? []).map((p) => p.id),
      targetProductLabels: productLabels,
      targetVariantIds: (v.voucherForSpecialProductVariant ?? []).map((va) => va.id),
      targetVariantLabels: variantLabels,
      targetUserIds: (v.userVouchers ?? []).map((u) => u.userId),
      targetUserLabels: userLabels,
      productSearchQuery: "",
      variantSearchQuery: "",
      userSearchQuery: "",
    });
    setProductResults([]);
    setVariantResults([]);
    setDialogOpen(true);
    resetUserPicker("");
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.discountValue || !form.validFrom || !form.validTo) { toast.error("Vui lòng điền đầy đủ thông tin bắt buộc."); return; }
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      if (dialogMode === "create") {
        const payload: CreateVoucherDto = {
          code: form.code.trim(),
          description: form.description.trim() || undefined,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          validFrom: new Date(form.validFrom).toISOString(),
          validTo: new Date(form.validTo).toISOString(),
          usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
          timesUsed: 0,
          isActive: form.isActive,
          createdBy: parseInt(session.user.id),
          categoryIds: form.targetCategoryIds,
          productIds: form.targetProductIds,
          variantIds: form.targetVariantIds,
          userIds: form.targetUserIds,
        };
        await voucherService.createVoucher(payload, accessToken);
      } else if (editingId !== null) {
        const payload = {
          code: form.code.trim(),
          description: form.description.trim() || undefined,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          validFrom: new Date(form.validFrom).toISOString(),
          validTo: new Date(form.validTo).toISOString(),
          usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
          isActive: form.isActive,
          categoryIds: form.targetCategoryIds,
          productIds: form.targetProductIds,
          variantIds: form.targetVariantIds,
          userIds: form.targetUserIds,
        };
        await voucherService.updateVoucher(editingId, payload, accessToken);
      }
      setDialogOpen(false);
      fetchAllVouchers();
    } catch (err) {
      console.error("[CouponsClient] Save error:", err);
      toast.error("Lưu voucher thất bại.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await voucherService.deleteVoucher(id, accessToken);
      setDeleteConfirmId(null);
      fetchAllVouchers();
    } catch (err) { console.error("[CouponsClient] Delete error:", err); toast.error("Xóa voucher thất bại."); }
  };

  const activeFilterCount = (appliedFilter.discountType !== "" ? 1 : 0) + (appliedFilter.isActive !== "all" ? 1 : 0);
  const COLS = readonly ? COLS_READONLY : COLS_FULL;

  // ----- chip + picker section helpers (kept inline; lightweight) -----
  const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <span className="inline-flex items-center gap-1 bg-[var(--admin-green-light)] text-[var(--admin-green-dark)] text-xs px-2 py-1 rounded-md font-medium">
      <span className="max-w-[14rem] truncate">{label}</span>
      <button type="button" onClick={onRemove} className="cursor-pointer hover:text-red-500 ml-0.5"><X size={11} /></button>
    </span>
  );

  const removeCategory = (id: number) =>
    setForm((f) => ({ ...f, targetCategoryIds: f.targetCategoryIds.filter((x) => x !== id) }));
  const addCategory = (id: number) =>
    setForm((f) => (f.targetCategoryIds.includes(id) ? f : { ...f, targetCategoryIds: [...f.targetCategoryIds, id] }));

  const removeProduct = (id: number) =>
    setForm((f) => {
      const { [id]: _drop, ...rest } = f.targetProductLabels;
      void _drop;
      return { ...f, targetProductIds: f.targetProductIds.filter((x) => x !== id), targetProductLabels: rest };
    });
  const addProduct = (p: ProductDto) =>
    setForm((f) => (f.targetProductIds.includes(p.id)
      ? f
      : { ...f, targetProductIds: [...f.targetProductIds, p.id], targetProductLabels: { ...f.targetProductLabels, [p.id]: p.name }, productSearchQuery: "" }));

  const removeVariant = (id: number) =>
    setForm((f) => {
      const { [id]: _drop, ...rest } = f.targetVariantLabels;
      void _drop;
      return { ...f, targetVariantIds: f.targetVariantIds.filter((x) => x !== id), targetVariantLabels: rest };
    });
  const addVariant = (v: { id: number; variantName: string; colorId: number; variantSize: string }) =>
    setForm((f) => {
      if (f.targetVariantIds.includes(v.id)) return f;
      const colorName = colorById[v.colorId]?.name;
      const suffix = [v.variantSize, colorName].filter(Boolean).join(" · ");
      const label = suffix ? `${v.variantName} (${suffix})` : v.variantName;
      return {
        ...f,
        targetVariantIds: [...f.targetVariantIds, v.id],
        targetVariantLabels: { ...f.targetVariantLabels, [v.id]: label },
        variantSearchQuery: "",
      };
    });

  const removeUser = (id: number) =>
    setForm((f) => {
      const { [id]: _drop, ...rest } = f.targetUserLabels;
      void _drop;
      return { ...f, targetUserIds: f.targetUserIds.filter((x) => x !== id), targetUserLabels: rest };
    });
  const addUser = (u: UserDto) =>
    setForm((f) => (f.targetUserIds.includes(u.id)
      ? f
      : { ...f, targetUserIds: [...f.targetUserIds, u.id], targetUserLabels: { ...f.targetUserLabels, [u.id]: userDisplayName(u) } }));

  const availableCategories = categories.filter((c) => !form.targetCategoryIds.includes(c.id));

  // User picker — virtualized list of fetched users with already-selected filtered out.
  const visiblePickerUsers = useMemo(
    () => pickerUsers.filter((u) => !form.targetUserIds.includes(u.id)),
    [pickerUsers, form.targetUserIds],
  );

  const USER_ITEM_HEIGHT = 44;
  const userVirtualizer = useVirtualizer({
    count: visiblePickerUsers.length,
    getScrollElement: () => userListScrollRef.current,
    estimateSize: () => USER_ITEM_HEIGHT,
    overscan: 8,
  });

  const userVirtualItems = userVirtualizer.getVirtualItems();
  useEffect(() => {
    if (!dialogOpen) return;
    const last = userVirtualItems[userVirtualItems.length - 1];
    if (!last) return;
    if (
      last.index >= visiblePickerUsers.length - 3 &&
      userPickerHasMore &&
      !userPickerLoadingMore &&
      !userPickerLoading
    ) {
      fetchMoreUsers(form.userSearchQuery);
    }
  }, [userVirtualItems, visiblePickerUsers.length, userPickerHasMore, userPickerLoadingMore, userPickerLoading, fetchMoreUsers, form.userSearchQuery, dialogOpen]);

  return (
    <div className="h-full p-3 sm:p-4 md:p-6 flex flex-col">
      {/* Delete Confirmation */}
      {!readonly && deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[#023337] mb-2">Xác nhận xóa</h3>
            <p className="text-gray-600 mb-4">Bạn có chắc chắn muốn xóa voucher này?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md cursor-pointer">Hủy</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md cursor-pointer">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-[#151515]">Voucher</h1>
        {!readonly && (
          <Button onClick={openCreate} className="flex items-center gap-2 cursor-pointer">
            <PlusSquare size={18} />
            Thêm voucher
          </Button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Search + Filter */}
        <div className="flex items-center gap-2 flex-wrap px-3 sm:px-4 pt-3 pb-2 flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Tìm mã voucher..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 pr-8 py-2 bg-gray-100 text-sm outline-none focus:ring-1 focus:ring-[var(--admin-green-mid)] rounded-md w-full" />
            {searchInput && <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={14} /></button>}
          </div>
          <div className="relative" ref={filterPanelRef}>
            <Button variant={activeFilterCount > 0 ? "default" : "outline"} size="sm" onClick={() => { setPendingFilter(appliedFilter); setFilterOpen((o) => !o); }} className="gap-2 cursor-pointer">
              <SlidersHorizontal size={15} />
              Bộ lọc
              {activeFilterCount > 0 && <span className="bg-white/20 text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full">{activeFilterCount}</span>}
            </Button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 shadow-lg rounded-lg z-30 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Bộ lọc</p>
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1.5">Loại giảm giá</p>
                  <div className="flex gap-2 flex-wrap">
                    {([["", "Tất cả"], ["FIXED_AMOUNT", "Số tiền"], ["PERCENTAGE", "Phần trăm"]] as const).map(([val, label]) => (
                      <Button key={val} size="sm" variant={pendingFilter.discountType === val ? "default" : "outline"} onClick={() => setPendingFilter((f) => ({ ...f, discountType: val as FilterState["discountType"] }))} className="cursor-pointer">{label}</Button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1.5">Trạng thái</p>
                  <div className="flex gap-2 flex-wrap">
                    {([["all", "Tất cả"], ["active", "Còn hiệu lực"], ["inactive", "Hết hiệu lực"]] as const).map(([val, label]) => (
                      <Button key={val} size="sm" variant={pendingFilter.isActive === val ? "default" : "outline"} onClick={() => setPendingFilter((f) => ({ ...f, isActive: val }))} className="cursor-pointer">{label}</Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Button variant="outline" size="sm" onClick={resetFilters} className="flex-1 cursor-pointer">Đặt lại</Button>
                  <Button size="sm" onClick={applyFilters} className="flex-1 cursor-pointer">Áp dụng</Button>
                </div>
              </div>
            )}
          </div>
          {hasActiveFilters(appliedFilter) && (
            <div className="flex items-center gap-1.5 flex-wrap ml-1">
              {appliedFilter.discountType && (
                <span className="flex items-center gap-1 bg-[var(--admin-green-light)] text-[var(--admin-green-dark)] text-xs px-2 py-0.5 font-medium rounded-md">
                  {appliedFilter.discountType === "PERCENTAGE" ? "Phần trăm" : "Số tiền"}
                  <button onClick={() => setAppliedFilter((f) => ({ ...f, discountType: "" }))} className="cursor-pointer hover:text-red-500"><X size={11} /></button>
                </span>
              )}
              {appliedFilter.isActive !== "all" && (
                <span className="flex items-center gap-1 bg-[var(--admin-green-light)] text-[var(--admin-green-dark)] text-xs px-2 py-0.5 font-medium rounded-md">
                  {appliedFilter.isActive === "active" ? "Còn hiệu lực" : "Hết hiệu lực"}
                  <button onClick={() => setAppliedFilter((f) => ({ ...f, isActive: "all" }))} className="cursor-pointer hover:text-red-500"><X size={11} /></button>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-x-auto">
          <div className="min-w-[1200px] flex flex-col flex-1 min-h-0">
        {/* Table Header */}
        <div className="grid bg-[#eaf8e7] flex-shrink-0 text-sm font-semibold text-[#023337]" style={{ gridTemplateColumns: COLS }}>
          <div className="px-4 py-3">STT</div>
          <div className="px-4 py-3">Mã</div>
          <div className="px-4 py-3">Mô tả</div>
          <div className="px-4 py-3">Loại giảm giá</div>
          <div className="px-4 py-3">Giá trị</div>
          <div className="px-4 py-3">Từ ngày</div>
          <div className="px-4 py-3">Đến ngày</div>
          <div className="px-4 py-3">Trạng thái</div>
          <div className="px-4 py-3">Áp dụng cho</div>
          {!readonly && <div className="px-4 py-3">Hành động</div>}
        </div>

        {/* Body */}
        <div ref={tableContainerRef} className="overflow-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin" />Đang tải...</div>
          ) : filteredVouchers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Không có voucher nào</div>
          ) : (
            <>
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const v = filteredVouchers[virtualRow.index];
                  return (
                    <div key={v.id} className="grid border-t border-gray-100 hover:bg-gray-50 items-center text-sm text-black" style={{ gridTemplateColumns: COLS, position: "absolute", top: 0, left: 0, width: "100%", height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}>
                      <div className="px-4 py-3 text-gray-500">{virtualRow.index + 1}</div>
                      <div className="px-4 py-3 font-mono font-semibold tracking-wide">{v.code}</div>
                      <div className="px-4 py-3 text-gray-600 truncate">{v.description ?? "—"}</div>
                      <div className="px-4 py-3">
                        <Badge className={`border-0 ${v.discountType === "PERCENTAGE" ? "bg-[var(--admin-green-light)] text-[var(--admin-green-dark)]" : "bg-gray-100 text-gray-600"}`}>
                          {v.discountType === "PERCENTAGE" ? "Phần trăm" : "Số tiền cố định"}
                        </Badge>
                      </div>
                      <div className="px-4 py-3 font-semibold">{v.discountType === "PERCENTAGE" ? `${v.discountValue}%` : `${v.discountValue.toLocaleString("vi-VN")} ₫`}</div>
                      <div className="px-4 py-3 text-gray-600">{formatDate(v.validFrom)}</div>
                      <div className="px-4 py-3 text-gray-600">{formatDate(v.validTo)}</div>
                      <div className="px-4 py-3">
                        <Badge className={`border-0 ${v.isActive ? "bg-[var(--admin-green-light)] text-[var(--admin-green-dark)]" : "bg-gray-100 text-gray-500"}`}>
                          {v.isActive ? "Còn hiệu lực" : "Hết hiệu lực"}
                        </Badge>
                      </div>
                      <div className="px-4 py-3"><VoucherTargetCell voucher={v} /></div>
                      {!readonly && (
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEdit(v)} className="p-1.5 hover:bg-[var(--admin-green-light)] rounded-md cursor-pointer" title="Chỉnh sửa"><Pencil size={16} className="text-gray-600" /></button>
                            <button onClick={() => setDeleteConfirmId(v.id)} className="p-1.5 hover:bg-red-50 rounded-md cursor-pointer" title="Xóa"><Trash2 size={16} className="text-red-500" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {loadingMore && <div className="flex items-center justify-center py-4 gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin" />Đang tải thêm...</div>}
            </>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Dialog — only for non-readonly */}
      {!readonly && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogMode === "create" ? "Thêm voucher mới" : "Chỉnh sửa voucher"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-sm text-gray-600">Mã voucher *</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VD: SAVE20" className="mt-1 font-mono" /></div>
                <div>
                  <Label className="text-sm text-gray-600">Loại giảm giá *</Label>
                  <Select value={form.discountType} onValueChange={(v) => setForm((f) => ({ ...f, discountType: v as DiscountType }))}>
                    <SelectTrigger className="mt-1 w-full cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="FIXED_AMOUNT">Số tiền cố định (₫)</SelectItem><SelectItem value="PERCENTAGE">Phần trăm (%)</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-sm text-gray-600">Mô tả</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="VD: Giảm 20% cho đơn hàng đầu tiên" className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-sm text-gray-600">Giá trị * {form.discountType === "PERCENTAGE" ? "(%)" : "(₫)"}</Label><Input type="number" min="0" value={form.discountValue} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} placeholder={form.discountType === "PERCENTAGE" ? "VD: 20" : "VD: 50000"} className="mt-1" /></div>
                <div><Label className="text-sm text-gray-600">Giới hạn sử dụng</Label><Input type="number" min="0" value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} placeholder="Không giới hạn" className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-sm text-gray-600">Từ ngày *</Label><Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} className="mt-1 cursor-pointer" /></div>
                <div><Label className="text-sm text-gray-600">Đến ngày *</Label><Input type="date" value={form.validTo} onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))} className="mt-1 cursor-pointer" /></div>
              </div>
              {dialogMode === "edit" && (
                <div className="flex items-center gap-3">
                  <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} className="cursor-pointer" />
                  <Label className="text-sm text-gray-600 cursor-pointer" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}>{form.isActive ? "Còn hiệu lực" : "Hết hiệu lực"}</Label>
                </div>
              )}

              {/* Targets — 4 multi-select sections */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700">Voucher áp dụng cho</p>

                {/* Categories */}
                <div>
                  <Label className="text-sm text-gray-600">Danh mục</Label>
                  {form.targetCategoryIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.targetCategoryIds.map((id) => {
                        const c = categories.find((x) => x.id === id);
                        return <Chip key={id} label={c?.name ?? `#${id}`} onRemove={() => removeCategory(id)} />;
                      })}
                    </div>
                  )}
                  <Select value="" onValueChange={(v) => v && addCategory(Number(v))}>
                    <SelectTrigger className="mt-2 w-full cursor-pointer">
                      <SelectValue placeholder={availableCategories.length === 0 ? "Đã chọn tất cả danh mục" : "Thêm danh mục..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Products */}
                <div>
                  <Label className="text-sm text-gray-600">Sản phẩm</Label>
                  {form.targetProductIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.targetProductIds.map((id) => (
                        <Chip key={id} label={form.targetProductLabels[id] ?? `#${id}`} onRemove={() => removeProduct(id)} />
                      ))}
                    </div>
                  )}
                  <div className="relative mt-2">
                    <Input
                      placeholder="Tìm sản phẩm theo tên..."
                      value={form.productSearchQuery}
                      onChange={(e) => { const val = e.target.value; setForm((f) => ({ ...f, productSearchQuery: val })); runProductSearch(val); }}
                    />
                    {productSearchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                  </div>
                  {productResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                      {productResults
                        .filter((p) => !form.targetProductIds.includes(p.id))
                        .map((p) => (
                          <button key={p.id} type="button" onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--admin-green-light)] cursor-pointer border-b border-gray-100 last:border-0">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-gray-400 text-xs ml-2">#{p.id}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Variants */}
                <div>
                  <Label className="text-sm text-gray-600">Phiên bản sản phẩm</Label>
                  {form.targetVariantIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.targetVariantIds.map((id) => (
                        <Chip key={id} label={form.targetVariantLabels[id] ?? `#${id}`} onRemove={() => removeVariant(id)} />
                      ))}
                    </div>
                  )}
                  <div className="relative mt-2">
                    <Input
                      placeholder="Tìm phiên bản theo tên sản phẩm..."
                      value={form.variantSearchQuery}
                      onChange={(e) => { const val = e.target.value; setForm((f) => ({ ...f, variantSearchQuery: val })); runVariantSearch(val); }}
                    />
                    {variantSearchLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                  </div>
                  {variantResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                      {variantResults
                        .filter((v) => !form.targetVariantIds.includes(v.id))
                        .map((v) => {
                          const colorName = colorById[v.colorId]?.name;
                          const suffix = [v.variantSize, colorName].filter(Boolean).join(" · ");
                          return (
                            <button key={v.id} type="button" onClick={() => addVariant(v)} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--admin-green-light)] cursor-pointer border-b border-gray-100 last:border-0">
                              <span className="font-medium">{v.variantName}</span>
                              {suffix && <span className="text-gray-500 text-xs ml-2">{suffix}</span>}
                              <span className="text-gray-400 text-xs ml-2">#{v.id}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Users */}
                <div>
                  <Label className="text-sm text-gray-600">Người dùng</Label>
                  {form.targetUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.targetUserIds.map((id) => (
                        <Chip key={id} label={form.targetUserLabels[id] ?? `#${id}`} onRemove={() => removeUser(id)} />
                      ))}
                    </div>
                  )}
                  <div className="relative mt-2">
                    <Input
                      placeholder="Tìm theo tên, email, số điện thoại..."
                      value={form.userSearchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm((f) => ({ ...f, userSearchQuery: val }));
                        if (userSearchDebounceRef.current) clearTimeout(userSearchDebounceRef.current);
                        userSearchDebounceRef.current = setTimeout(() => { resetUserPicker(val); }, 300);
                      }}
                    />
                    {userPickerLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
                  </div>
                  <div
                    ref={userListScrollRef}
                    className="mt-1 border border-gray-200 rounded-md overflow-y-auto"
                    style={{ height: 240 }}
                  >
                    {userPickerLoading && pickerUsers.length === 0 ? (
                      <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2">
                        <Loader2 size={14} className="animate-spin" />Đang tải...
                      </div>
                    ) : visiblePickerUsers.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-gray-400">
                        {pickerUsers.length === 0 ? "Không tìm thấy người dùng" : "Đã chọn tất cả người dùng phù hợp"}
                      </p>
                    ) : (
                      <>
                        <div style={{ height: userVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
                          {userVirtualItems.map((vi) => {
                            const u = visiblePickerUsers[vi.index];
                            if (!u) return null;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => addUser(u)}
                                className="text-left px-3 py-2 text-sm hover:bg-[var(--admin-green-light)] cursor-pointer border-b border-gray-100 last:border-0 flex items-center gap-2"
                                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: USER_ITEM_HEIGHT, transform: `translateY(${vi.start}px)` }}
                              >
                                <span className="font-medium flex-1 truncate">{userDisplayName(u)}</span>
                                <span className="text-gray-400 text-xs shrink-0">{u.email}</span>
                              </button>
                            );
                          })}
                        </div>
                        {userPickerLoadingMore && (
                          <div className="flex items-center justify-center py-2 text-gray-400 text-xs gap-2">
                            <Loader2 size={14} className="animate-spin" />Đang tải thêm...
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Hủy</Button>
              <Button onClick={handleSave} disabled={saving} className="cursor-pointer">{saving ? "Đang lưu..." : dialogMode === "create" ? "Tạo" : "Cập nhật"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
