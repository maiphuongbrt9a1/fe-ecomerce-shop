"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ProductFormState } from "../_types";

interface ProductBasicInfoCardProps {
  formState: ProductFormState;
  onFieldChange: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void;
}

export default function ProductBasicInfoCard({
  formState,
  onFieldChange,
}: ProductBasicInfoCardProps) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 md:p-6">
        <h3 className="text-lg font-semibold text-[var(--admin-green-dark)] mb-4">
          Thông tin cơ bản
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm text-gray-600">
              Tên sản phẩm
            </Label>
            <Input
              id="name"
              value={formState.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="Nhập tên sản phẩm"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description" className="text-sm text-gray-600">
              Mô tả
            </Label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(e) => onFieldChange("description", e.target.value)}
              placeholder="Nhập mô tả sản phẩm"
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sku" className="text-sm text-gray-600">
              SKU <span className="text-xs text-gray-400">(tự động)</span>
            </Label>
            <Input
              id="sku"
              value={formState.stockKeepingUnit}
              readOnly
              className="mt-1 bg-gray-50 text-gray-500 cursor-default font-mono text-xs"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
