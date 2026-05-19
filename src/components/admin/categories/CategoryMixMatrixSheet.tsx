"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CategoryDto } from "@/dto/category";
import { categoryMappingService } from "@/services/category-mapping";

export interface CategoryMixMatrixSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allCategories: CategoryDto[];
  accessToken: string;
  onSaved?: () => void;
}

/**
 * Encode a pair (base, suggest) as a single key for a Set. The matrix uses
 * symmetric semantics, so we always store both "a:b" and "b:a".
 */
const pairKey = (base: number, suggest: number) => `${base}:${suggest}`;

export default function CategoryMixMatrixSheet({
  open,
  onOpenChange,
  allCategories,
  accessToken,
  onSaved,
}: CategoryMixMatrixSheetProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Server snapshot at load time — for diffing on save.
  const [initialPairs, setInitialPairs] = useState<Set<string>>(new Set());
  // Live edits — toggled by clicking cells.
  const [pairs, setPairs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setInitialPairs(new Set());
    setPairs(new Set());
    categoryMappingService
      .getAll(accessToken)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const next = new Set<string>();
        for (const m of list) {
          next.add(pairKey(Number(m.baseCategoryId), Number(m.suggestCategoryId)));
        }
        setInitialPairs(new Set(next));
        setPairs(next);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[CategoryMixMatrixSheet] load error:", err);
        toast.error("Không tải được ma trận gợi ý");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  const sortedCategories = useMemo(
    () => [...allCategories].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [allCategories],
  );

  const toggleCell = (rowId: number, colId: number) => {
    if (rowId === colId) return;
    setPairs((prev) => {
      const next = new Set(prev);
      const key = pairKey(rowId, colId);
      // Asymmetric: each cell is its own independent direction.
      // (row, col) means "when viewing row, recommend col" — the reverse
      // (col, row) is configured separately.
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  /** Bases whose outgoing-suggest set differs from the server snapshot. */
  const dirtyBaseIds = useMemo(() => {
    const dirty = new Set<number>();
    for (const c of allCategories) {
      const before = new Set<number>();
      const after = new Set<number>();
      for (const other of allCategories) {
        if (other.id === c.id) continue;
        if (initialPairs.has(pairKey(c.id, other.id))) before.add(other.id);
        if (pairs.has(pairKey(c.id, other.id))) after.add(other.id);
      }
      if (before.size !== after.size) {
        dirty.add(c.id);
        continue;
      }
      for (const id of before) {
        if (!after.has(id)) {
          dirty.add(c.id);
          break;
        }
      }
    }
    return dirty;
  }, [allCategories, initialPairs, pairs]);

  const handleSave = async () => {
    console.log(
      "[CategoryMixMatrixSheet] save start. dirty bases:",
      Array.from(dirtyBaseIds),
      "initialPairs size:",
      initialPairs.size,
      "pairs size:",
      pairs.size,
    );
    if (dirtyBaseIds.size === 0) {
      console.warn("[CategoryMixMatrixSheet] no dirty bases — nothing to save");
      return;
    }
    setSaving(true);
    try {
      const payloads = Array.from(dirtyBaseIds).map((baseId) => {
        // Iterate `pairs` directly (not allCategories) so we preserve every
        // outgoing edge currently in local state — even ones whose suggest
        // category isn't in the rendered `allCategories` list. Iterating
        // allCategories would silently drop those on save.
        const baseStr = String(baseId);
        const suggestIds: number[] = [];
        for (const key of pairs) {
          const sep = key.indexOf(":");
          if (sep === -1) continue;
          if (key.slice(0, sep) !== baseStr) continue;
          suggestIds.push(Number(key.slice(sep + 1)));
        }
        return {
          baseCategoryId: Number(baseId),
          suggestCategoryIds: suggestIds,
          symmetric: false,
        };
      });
      console.log("[CategoryMixMatrixSheet] sync payloads:", payloads);
      const responses = await Promise.all(
        payloads.map((p) => categoryMappingService.sync(p, accessToken)),
      );
      console.log("[CategoryMixMatrixSheet] sync responses:", responses);
      toast.success(`Đã lưu ${dirtyBaseIds.size} danh mục`);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[CategoryMixMatrixSheet] save error:", err);
      toast.error(
        err instanceof Error
          ? `Lưu ma trận thất bại: ${err.message}`
          : "Lưu ma trận thất bại",
      );
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = dirtyBaseIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[min(1200px,95vw)] w-[min(1200px,95vw)] max-h-[90vh] flex flex-col"
      >
        <DialogHeader className="text-left sm:text-left">
          <DialogTitle className="text-[var(--admin-green-dark)]">
            Ma trận gợi ý mix
          </DialogTitle>
          <DialogDescription>
            Mỗi ô là một chiều độc lập: ô (hàng A, cột B) nghĩa là "khi xem
            A, gợi ý mix với B". Chiều ngược lại (B → A) cần cấu hình riêng.
          </DialogDescription>
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-gray-500">
              {hasChanges
                ? `${dirtyBaseIds.size} danh mục có thay đổi chưa lưu`
                : "Chưa có thay đổi"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="cursor-pointer"
              >
                Đóng
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || saving || loading}
                className="cursor-pointer"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border border-gray-200">
          {loading ? (
            <div className="h-full min-h-[200px] flex items-center justify-center">
              <Loader2 className="animate-spin text-[var(--admin-green-dark)] w-8 h-8" />
            </div>
          ) : sortedCategories.length === 0 ? (
            <div className="h-full min-h-[200px] flex items-center justify-center text-gray-400 text-sm">
              Chưa có danh mục nào
            </div>
          ) : (
            <div className="flex flex-col w-full">
              {/* Header row */}
              <div className="flex sticky top-0 z-10 bg-[var(--admin-green-light)] border-b border-gray-200">
                <div className="w-[140px] shrink-0 px-3 py-2 border-r border-gray-200 text-[var(--admin-green-dark)] font-semibold text-sm">
                  Danh mục
                </div>
                {sortedCategories.map((c, i) => (
                  <div
                    key={c.id}
                    className={`flex-1 min-w-0 px-2 py-2 text-[var(--admin-green-dark)] font-semibold text-xs ${
                      i < sortedCategories.length - 1
                        ? "border-r border-gray-200"
                        : ""
                    }`}
                    title={c.name}
                  >
                    <div className="line-clamp-3 break-words leading-tight">
                      {c.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {sortedCategories.map((row, ri) => {
                const rowDirty = dirtyBaseIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    className={`flex ${
                      ri < sortedCategories.length - 1
                        ? "border-b border-gray-200"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-[140px] shrink-0 px-3 py-2 border-r border-gray-200 text-sm font-medium ${
                        rowDirty
                          ? "bg-[var(--admin-green-light)] text-[var(--admin-green-dark)]"
                          : "bg-white text-gray-700"
                      }`}
                    >
                      <div
                        className="flex items-start gap-2"
                        title={row.name}
                      >
                        {rowDirty && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--admin-green-dark)] shrink-0 mt-1.5" />
                        )}
                        <span className="line-clamp-3 break-words leading-tight">
                          {row.name}
                        </span>
                      </div>
                    </div>
                    {sortedCategories.map((col, ci) => {
                      const isDiagonal = row.id === col.id;
                      const active = pairs.has(pairKey(row.id, col.id));
                      return (
                        <div
                          key={col.id}
                          className={`flex-1 min-w-0 ${
                            ci < sortedCategories.length - 1
                              ? "border-r border-gray-200"
                              : ""
                          } ${
                            isDiagonal
                              ? "bg-gray-100"
                              : active
                              ? "bg-[var(--admin-green-mid)]"
                              : "bg-white"
                          }`}
                        >
                          {isDiagonal ? (
                            <div className="w-full h-full min-h-9 flex items-center justify-center text-gray-300 select-none">
                              —
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggleCell(row.id, col.id)}
                              className={`w-full h-full min-h-9 flex items-center justify-center cursor-pointer transition-colors ${
                                active
                                  ? "hover:bg-[var(--admin-green-mid)]/70"
                                  : "hover:bg-gray-50"
                              }`}
                              aria-pressed={active}
                              aria-label={`${row.name} mix với ${col.name}`}
                            >
                              {active && (
                                <Check className="w-4 h-4 text-[var(--admin-green-dark)]" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
