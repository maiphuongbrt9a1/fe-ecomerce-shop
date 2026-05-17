"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CategoryDto } from "@/dto/category";
import { categoryMappingService } from "@/services/category-mapping";

export interface CategoryMixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The "base" category we are configuring mixes for. */
  category: CategoryDto | null;
  /** All categories (already loaded by the parent table). */
  allCategories: CategoryDto[];
  accessToken: string;
  /** Fires after a successful save so the parent can refresh count badges. */
  onSaved?: () => void;
}

export default function CategoryMixDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  accessToken,
  onSaved,
}: CategoryMixDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Reload current mappings every time the dialog opens for a new category.
  useEffect(() => {
    if (!open || !category) return;
    let cancelled = false;
    setLoading(true);
    setSelectedIds(new Set());
    categoryMappingService
      .getByBase(category.id, accessToken)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setSelectedIds(new Set(list.map((m) => Number(m.suggestCategoryId))));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[CategoryMixDialog] load error:", err);
        toast.error("Không tải được danh sách gợi ý hiện tại");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, category, accessToken]);

  const others = useMemo(
    () => allCategories.filter((c) => c.id !== category?.id),
    [allCategories, category],
  );

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!category) return;
    setSaving(true);
    try {
      await categoryMappingService.sync(
        {
          baseCategoryId: category.id,
          suggestCategoryIds: Array.from(selectedIds),
          symmetric: true,
        },
        accessToken,
      );
      toast.success("Đã lưu gợi ý mix");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[CategoryMixDialog] save error:", err);
      toast.error("Lưu gợi ý mix thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Gợi ý mix cho:{" "}
            <span className="text-[var(--admin-green-dark)]">
              {category?.name ?? "—"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-gray-500 mb-3">
            Chọn các danh mục muốn mix với danh mục này. Việc lưu sẽ tự động đồng
            bộ hai chiều.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-[var(--admin-green-dark)] w-6 h-6" />
            </div>
          ) : others.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">
              Không có danh mục khác để mix
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto">
              {others.map((c) => {
                const active = selectedIds.has(c.id);
                return (
                  <Button
                    key={c.id}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggle(c.id)}
                    className="cursor-pointer"
                    aria-pressed={active}
                  >
                    {c.name}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="cursor-pointer"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
