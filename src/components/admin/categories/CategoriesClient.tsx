"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, PlusSquare } from "lucide-react";
import { categoryService } from "@/services/category";
import type { CategoryDto } from "@/dto/category";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CategoriesClientProps {
  readonly?: boolean;
}

export default function CategoriesClient({ readonly = false }: CategoriesClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken = session?.user?.access_token || "";

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const PER_PAGE = 10;
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDesc, setCategoryDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setCategories([]);
    const all: CategoryDto[] = [];
    let page = 1;
    try {
      while (true) {
        console.log("[CategoriesClient] Fetching categories page:", page);
        const res = await categoryService.getCategoriesPage(page, PER_PAGE, accessToken);
        const data = res.data ?? [];
        if (data.length === 0) break;
        all.push(...data);
        setCategories(all.slice());
        if (data.length < PER_PAGE) break;
        page += 1;
      }
      console.log("[CategoriesClient] Done. Total:", all.length);
    } catch (err) {
      console.error("[CategoriesClient] Error:", err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, PER_PAGE]);

  useEffect(() => {
    if (accessToken) fetchCategories();
  }, [accessToken, fetchCategories]);

  const openAddDialog = () => {
    setDialogMode("add");
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDesc("");
    setDialogOpen(true);
  };

  const openEditDialog = (cat: CategoryDto) => {
    setDialogMode("edit");
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDesc(cat.description ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim() || !session?.user?.id) return;
    setSaving(true);
    try {
      if (dialogMode === "add") {
        await categoryService.createCategory(
          {
            name: categoryName.trim(),
            description: categoryDesc.trim() || categoryName.trim(),
            createByUserId: parseInt(session.user.id),
          },
          accessToken
        );
        toast.success("Tạo danh mục thành công");
      } else if (editingCategory) {
        const { sendRequest } = await import("@/utils/api");
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
        await sendRequest<IBackendRes<CategoryDto>>({
          url: `${BACKEND_URL}/category/${editingCategory.id}`,
          method: "PATCH",
          body: { name: categoryName.trim(), description: categoryDesc.trim() },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        toast.success("Cập nhật danh mục thành công");
      }
      setDialogOpen(false);
      await fetchCategories();
    } catch (err) {
      console.error("[CategoriesClient] Save error:", err);
      toast.error(dialogMode === "add" ? "Tạo danh mục thất bại" : "Cập nhật danh mục thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { sendRequest } = await import("@/utils/api");
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      await sendRequest<IBackendRes<void>>({
        url: `${BACKEND_URL}/category/${id}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setDeleteConfirmId(null);
      toast.success("Đã xoá danh mục");
      await fetchCategories();
    } catch (err) {
      console.error("[CategoriesClient] Delete error:", err);
      toast.error("Xoá danh mục thất bại");
    }
  };

  const handleRowClick = (categoryId: number) => {
    const base = router ? (window.location.pathname.startsWith("/staff") ? "/staff" : "/admin") : "/admin";
    router.push(`${base}/products/list?categoryId=${categoryId}`);
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      {/* Delete Confirmation */}
      {!readonly && deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[#023337] mb-2">Xác nhận xóa</h3>
            <p className="text-gray-600 mb-4">Bạn có chắc chắn muốn xóa danh mục này?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer">Hủy</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer">Xóa</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-xl sm:text-2xl font-bold text-[#151515] mb-4 sm:mb-6">Danh mục</h1>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="min-w-[760px]">
        {/* Table Header */}
        <div className="bg-[#eaf8e7] flex items-center gap-4 p-2 rounded-t-md">
          <div className="w-16 px-2 py-2.5"><span className="text-sm font-medium text-[#023337]">STT</span></div>
          <div className="flex-1 px-2.5 py-2.5 text-center"><span className="text-sm font-medium text-[#023337]">Tên danh mục</span></div>
          <div className="flex-1 px-2.5 py-2.5 text-center"><span className="text-sm font-medium text-[#023337]">Mô tả</span></div>
          <div className="flex-1 px-2.5 py-2.5 text-center"><span className="text-sm font-medium text-[#023337]">Ngày thêm</span></div>
          {!readonly && (
            <div className="flex-1 px-2.5 py-2.5 text-center"><span className="text-sm font-medium text-[#023337]">Hành động</span></div>
          )}
        </div>

        {/* Table Body */}
        <div className="flex flex-col">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Đang tải...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Chưa có danh mục nào</div>
          ) : (
            categories.map((cat, index) => (
              <div
                key={cat.id}
                onClick={() => handleRowClick(cat.id)}
                className="flex items-center gap-4 px-2 py-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="w-16 px-2 flex items-center">
                  <span className="text-sm text-black">{index + 1}</span>
                </div>
                <div className="flex-1 px-2.5 flex items-center justify-center">
                  <div className="flex items-center gap-3 w-[203px]">
                    <div className="w-10 h-10 rounded border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      <span className="text-gray-400 text-lg font-medium">{cat.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm text-black truncate">{cat.name}</span>
                  </div>
                </div>
                <div className="flex-1 px-2.5 text-center">
                  <span className="text-sm text-black line-clamp-2">{cat.description || "--"}</span>
                </div>
                <div className="flex-1 px-2.5 text-center">
                  <span className="text-sm text-black">{formatDate(cat.createdAt)}</span>
                </div>
                {!readonly && (
                  <div className="flex-1 px-2.5 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditDialog(cat)} className="p-1.5 hover:bg-gray-100 rounded cursor-pointer" title="Chỉnh sửa">
                        <Pencil size={18} className="text-gray-600" />
                      </button>
                      <button onClick={() => setDeleteConfirmId(cat.id)} className="p-1.5 hover:bg-red-50 rounded cursor-pointer" title="Xóa">
                        <Trash2 size={18} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {!readonly && (
            <button
              onClick={openAddDialog}
              className="flex items-center justify-center gap-2 px-2 py-3 border border-dashed border-[#4ea674] rounded-b-lg hover:bg-[#eaf8e7]/30 transition-colors cursor-pointer w-full"
            >
              <PlusSquare size={20} className="text-[#4ea674]" />
              <span className="text-sm font-bold text-[#4ea674] tracking-tight">Thêm danh mục</span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {!readonly && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{dialogMode === "add" ? "Thêm danh mục mới" : "Chỉnh sửa danh mục"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Tên danh mục</label>
                <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="VD: Áo Thun & Polo" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Mô tả</label>
                <Input value={categoryDesc} onChange={(e) => setCategoryDesc(e.target.value)} placeholder="Mô tả ngắn về danh mục" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">Hủy</Button>
              <Button type="button" onClick={handleSave} disabled={saving || !categoryName.trim()} className="bg-[#4ea674] hover:bg-[#3d8a5f] text-white cursor-pointer">
                {saving ? "Đang lưu..." : dialogMode === "add" ? "Tạo" : "Cập nhật"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
