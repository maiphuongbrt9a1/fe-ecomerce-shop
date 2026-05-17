"use client";

import { useRef } from "react";
import type { ProductFormState, ColorImage } from "../_types";

interface ColorImageUploadSectionProps {
  formState: ProductFormState;
  onColorImageChange: (colorName: string, file: File | null) => void;
  onColorImageRemove: (colorName: string) => void;
}

export default function ColorImageUploadSection({
  formState,
  onColorImageChange,
  onColorImageRemove,
}: ColorImageUploadSectionProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { selectedColors, colorImages } = formState;

  if (selectedColors.length === 0) return null;

  const handleFileSelect = (colorName: string, file: File) => {
    onColorImageChange(colorName, file);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 md:p-6">
      <h3 className="text-lg font-semibold text-[var(--admin-green-dark)] mb-4">
        Upload ảnh sản phẩm theo màu
      </h3>
      <div className="flex flex-wrap gap-3">
          {selectedColors.map((color) => {
            const ci = colorImages.find((c) => c.color === color.name);
            return (
              <div key={color.name} className="relative">
                <div
                  onClick={() => fileInputRefs.current[color.name]?.click()}
                  className="w-24 h-28 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 cursor-pointer hover:border-gray-400 transition-colors"
                >
                  {ci?.previewUrl ? (
                    <img
                      src={ci.previewUrl}
                      alt={color.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 text-2xl">+</span>
                  )}
                </div>
                {/* Color bar at bottom */}
                <div
                  className="h-2 rounded-b-lg -mt-1 mx-0.5"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-xs text-gray-500 text-center block mt-1">
                  {color.label}
                </span>
                {ci?.previewUrl && (
                  <button
                    type="button"
                    onClick={() => onColorImageRemove(color.name)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-red-600"
                  >
                    x
                  </button>
                )}
                <input
                  ref={(el) => { fileInputRefs.current[color.name] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(color.name, file);
                  }}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}
