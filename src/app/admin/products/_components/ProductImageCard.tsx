"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryDto } from "@/dto/category";
import type { ProductFormState } from "../_types";

interface ProductImageCardProps {
  formState: ProductFormState;
  categories: CategoryDto[];
  onFieldChange: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
  productImageFile: File | null;
  productImagePreview: string | null;
  onProductImageChange: (file: File | null) => void;
  onProductImageRemove: () => void;
}

export default function ProductImageCard({
  formState,
  categories,
  onFieldChange,
  productImagePreview,
  onProductImageChange,
  onProductImageRemove,
}: ProductImageCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      {/* Image Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 md:p-6">
        <h3 className="text-lg font-semibold text-[var(--admin-green-dark)] mb-4">
          Upload ảnh sản phẩm
        </h3>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors overflow-hidden"
        >
          {productImagePreview ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={productImagePreview}
                alt="Product"
                className="max-h-48 rounded-lg object-contain"
              />
              <p className="text-sm text-gray-500">Ảnh sản phẩm chính</p>
            </div>
          ) : (
            <>
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 mb-2">Nhấn để chọn ảnh sản phẩm</p>
            </>
          )}
        </div>
        {productImagePreview && (
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer"
            >
              Thay thế
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onProductImageRemove}
              className="border-red-300 text-red-500 hover:bg-red-50 cursor-pointer"
            >
              Xóa ảnh
            </Button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            onProductImageChange(file ?? null);
            if (e.target) e.target.value = "";
          }}
        />
      </div>

      {/* Category */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 md:p-6">
        <h3 className="text-lg font-semibold text-[var(--admin-green-dark)] mb-4">
          Loại sản phẩm
        </h3>
        <div>
          <Label className="text-sm text-gray-600">Danh mục</Label>
          <Select
            value={formState.categoryId?.toString() ?? ""}
            onValueChange={(value) => onFieldChange("categoryId", parseInt(value))}
          >
            <SelectTrigger className="mt-1 cursor-pointer">
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()} className="cursor-pointer">
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
