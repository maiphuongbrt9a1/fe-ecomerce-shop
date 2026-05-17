"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/services/product";
import { productVariantService } from "@/services/product-variant";
import { categoryService } from "@/services/category";
import { colorService } from "@/services/color";
import type { CreateProductDto, UpdateProductDto } from "@/dto/product";
import type { CreateProductVariantDto } from "@/dto/product-variant";
import type { CategoryDto } from "@/dto/category";
import type { ColorEntity } from "@/dto/color";
import type { ProductFormState, ColorEntry, VariantMatrix } from "../_types";
import { Button } from "@/components/ui/button";
import ProductBasicInfoCard from "./ProductBasicInfoCard";
import ProductImageCard from "./ProductImageCard";
import VariantMatrixSection from "./VariantMatrixSection";
import ColorImageUploadSection from "./ColorImageUploadSection";
import ProductFormActions from "./ProductFormActions";

const initialFormState: ProductFormState = {
  name: "",
  description: "",
  stockKeepingUnit: "",
  currencyUnit: "VND",
  categoryId: null,
  voucherId: null,
  selectedSizes: [],
  selectedColors: [],
  variantMatrix: {},
  colorImages: [],
};

interface ProductFormProps {
  productId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  stockOnly?: boolean;
}

export default function ProductForm({ productId, onSuccess, onCancel, stockOnly = false }: ProductFormProps) {
  const isModal = !!onCancel;
  const isEditMode = productId !== undefined;
  const { data: session } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [apiColors, setApiColors] = useState<ColorEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEditMode);
  const [formState, setFormState] = useState<ProductFormState>(initialFormState);
  const [variantIdMap, setVariantIdMap] = useState<Record<string, number>>({});
  const [originalVariantKeys, setOriginalVariantKeys] = useState<Set<string>>(new Set());
  // Variant IDs that have no image in the DB — backfilled on next save
  const [variantsWithoutMedia, setVariantsWithoutMedia] = useState<Set<number>>(new Set());

  // Product image state
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  // Track existing media ID for deletion on replace (edit mode)
  const [existingMediaId, setExistingMediaId] = useState<string | null>(null);
  // Whether the user removed the existing image
  const [imageRemoved, setImageRemoved] = useState(false);

  useEffect(() => {
    if (!session?.user?.access_token) return;
    const token = session.user.access_token;

    const fetchData = async () => {
      try {
        const [catRes, colorRes] = await Promise.all([
          categoryService.getAllCategories(token),
          colorService.getAllColors(token),
        ]);
        if (catRes.data) setCategories(catRes.data);
        const fetchedColors = colorRes.data ?? [];
        setApiColors(fetchedColors);

        if (isEditMode && productId) {
          const productRes = await productService.getProductById(String(productId), token);
          if (productRes.data) {
            const product = productRes.data;
            console.log("[ProductForm] Loaded product:", product);

            // Load product image from media array
            const productWithMedia = product as unknown as { media?: Array<{ id: number; url: string }> };
            if (productWithMedia.media && productWithMedia.media.length > 0) {
              setProductImagePreview(productWithMedia.media[0].url);
              setExistingMediaId(String(productWithMedia.media[0].id));
            }

            const sizesSet = new Set<string>();
            const colorsMap = new Map<string, ColorEntry>();
            const matrix: VariantMatrix = {};
            const idMap: Record<string, number> = {};
            const colorImagesMap = new Map<string, string | null>();
            const noMediaIds = new Set<number>();

            const variants = "productVariants" in product
              ? (product as unknown as { productVariants: Array<{
                  id: number; variantSize: string; variantColor: string;
                  colorId?: number;
                  stock: number; price: number; media?: Array<{ url: string }>;
                }> }).productVariants
              : [];

            for (const v of variants) {
              sizesSet.add(v.variantSize);

              // Primary lookup: colorId (source of truth)
              // Fallback: match by variantColor text (legacy data)
              const apiColor = fetchedColors.find((c) => c.id === v.colorId)
                ?? fetchedColors.find((c) => c.name === v.variantColor);
              const colorName = apiColor?.name ?? v.variantColor;
              const colorLabel = apiColor?.name ?? v.variantColor;
              const colorHex = apiColor?.hexCode ?? "#888888";
              const colorId = apiColor?.id;

              if (!colorsMap.has(colorName)) {
                colorsMap.set(colorName, { id: colorId, name: colorName, label: colorLabel, hex: colorHex });
              }

              const key = `${v.variantSize}__${colorName}`;
              matrix[key] = { stock: v.stock, price: v.price };
              idMap[key] = v.id;

              if (!colorImagesMap.has(colorName) && v.media && v.media.length > 0) {
                colorImagesMap.set(colorName, v.media[0].url);
              }

              // Track variants with no images so they get backfilled on save
              if (!v.media || v.media.length === 0) {
                noMediaIds.add(v.id);
              }
            }

            setVariantsWithoutMedia(noMediaIds);

            const selectedColors = Array.from(colorsMap.values());
            const selectedSizes = Array.from(sizesSet);

            // Fill missing size×color cells so the full matrix is initialized
            for (const size of selectedSizes) {
              for (const color of selectedColors) {
                const key = `${size}__${color.name}`;
                if (!matrix[key]) {
                  matrix[key] = { stock: 0, price: 0 };
                }
              }
            }
            // Pre-fetch color images via server-side proxy (avoids S3 CORS restriction)
            const colorImages = await Promise.all(
              selectedColors.map(async (c) => {
                const previewUrl = colorImagesMap.get(c.name) ?? null;
                let file: File | null = null;
                if (previewUrl) {
                  try {
                    const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(previewUrl)}`);
                    const blob = await resp.blob();
                    file = new File([blob], `${c.name}.jpg`, { type: blob.type || "image/jpeg" });
                  } catch {
                    // keep null — save-time fallback will retry via proxy
                  }
                }
                return { color: c.name, file, previewUrl, isPrefetched: file !== null };
              })
            );

            setFormState({
              name: product.name,
              description: product.description ?? "",
              stockKeepingUnit: product.stockKeepingUnit,
              currencyUnit: "VND",
              categoryId: product.categoryId ?? null,
              voucherId: product.voucherId ?? null,
              selectedSizes,
              selectedColors,
              variantMatrix: matrix,
              colorImages,
            });

            setVariantIdMap(idMap);
            setOriginalVariantKeys(new Set(Object.keys(idMap)));
          }
        }
      } catch (err) {
        console.error("[ProductForm] Error loading data:", err);
      } finally {
        setPageLoading(false);
      }
    };

    fetchData();
  }, [session, productId, isEditMode]);

  const handleFieldChange = useCallback(
    <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleMatrixCellChange = useCallback(
    (key: string, field: "stock" | "price", value: number) => {
      setFormState((prev) => ({
        ...prev,
        variantMatrix: {
          ...prev.variantMatrix,
          [key]: {
            stock: prev.variantMatrix[key]?.stock ?? 0,
            price: prev.variantMatrix[key]?.price ?? 0,
            [field]: value,
          },
        },
      }));
    },
    []
  );

  const handleAddColor = useCallback((color: ColorEntry) => {
    setFormState((prev) => {
      if (prev.selectedColors.find((c) => c.name === color.name)) return prev;
      const newColors = [...prev.selectedColors, color];
      const newMatrix: VariantMatrix = { ...prev.variantMatrix };
      prev.selectedSizes.forEach((size) => {
        const key = `${size}__${color.name}`;
        if (!newMatrix[key]) {
          newMatrix[key] = { stock: 0, price: 0 };
        }
      });
      const newColorImages = prev.colorImages.find((ci) => ci.color === color.name)
        ? prev.colorImages
        : [...prev.colorImages, { color: color.name, file: null, previewUrl: null }];
      return {
        ...prev,
        selectedColors: newColors,
        variantMatrix: newMatrix,
        colorImages: newColorImages,
      };
    });
  }, []);

  const handleColorImageChange = useCallback(
    (colorName: string, file: File | null) => {
      setFormState((prev) => ({
        ...prev,
        colorImages: prev.colorImages.map((ci) =>
          ci.color === colorName
            ? { ...ci, file, previewUrl: file ? URL.createObjectURL(file) : ci.previewUrl, isPrefetched: false }
            : ci
        ),
      }));
    },
    []
  );

  const handleColorImageRemove = useCallback((colorName: string) => {
    setFormState((prev) => ({
      ...prev,
      colorImages: prev.colorImages.map((ci) =>
        ci.color === colorName ? { ...ci, file: null, previewUrl: null } : ci
      ),
    }));
  }, []);

  const refreshColors = useCallback(async () => {
    if (!session?.user?.access_token) return;
    const res = await colorService.getAllColors(session.user.access_token);
    if (res.data) setApiColors(res.data);
  }, [session]);

  const handleCreateColor = useCallback(
    async (name: string, hexCode: string) => {
      if (!session?.user?.access_token) return;
      const now = new Date().toISOString();
      const res = await colorService.createColor(
        { name, hexCode, createdAt: now, updatedAt: now },
        session.user.access_token
      );
      console.log("[ProductForm] Created color:", res.data);
      await refreshColors();
    },
    [session, refreshColors]
  );

  const handleUpdateColor = useCallback(
    async (id: number, name: string, hexCode: string) => {
      if (!session?.user?.access_token) return;
      const now = new Date().toISOString();
      await colorService.updateColor(
        id,
        { name, hexCode, updatedAt: now },
        session.user.access_token
      );
      console.log("[ProductForm] Updated color:", id);
      await refreshColors();
      // Update selectedColors if the edited color is in use
      setFormState((prev) => ({
        ...prev,
        selectedColors: prev.selectedColors.map((c) =>
          c.id === id ? { ...c, name, label: name, hex: hexCode } : c
        ),
      }));
    },
    [session, refreshColors]
  );

  const handleDeleteColor = useCallback(
    async (id: number) => {
      if (!session?.user?.access_token) return;
      await colorService.deleteColor(id, session.user.access_token);
      console.log("[ProductForm] Deleted color:", id);
      await refreshColors();
    },
    [session, refreshColors]
  );

  const handleProductImageChange = useCallback((file: File | null) => {
    setProductImageFile(file);
    setProductImagePreview(file ? URL.createObjectURL(file) : null);
    setImageRemoved(false);
  }, []);

  const handleProductImageRemove = useCallback(() => {
    setProductImageFile(null);
    setProductImagePreview(null);
    setImageRemoved(true);
  }, []);

  const handleSave = async () => {
    if (!session?.user?.access_token || !session?.user?.id) {
      toast.error("Bạn cần đăng nhập để thực hiện thao tác này.");
      return;
    }

    const { name, description, categoryId } = formState;
    if (!name || !description || !categoryId) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc.");
      return;
    }

    // --- VARIANT VALIDATION ---
    const { selectedSizes, selectedColors, variantMatrix, colorImages } = formState;
    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      toast.error("Vui lòng thêm ít nhất một màu sắc và một kích cỡ để tạo sản phẩm con.");
      return;
    }

    // --- IMAGE VALIDATION ---
    // Every color in the matrix must have an image (either a new file or an existing previewUrl)
    if (selectedColors.length > 0) {
      const colorsWithoutImage = selectedColors.filter((color) => {
        const ci = colorImages.find((c) => c.color === color.name);
        return !ci?.file && !ci?.previewUrl;
      });
      if (colorsWithoutImage.length > 0) {
        const missing = colorsWithoutImage.map((c) => c.label).join(", ");
        toast.error(`Vui lòng upload ảnh cho tất cả màu sắc trước khi lưu. Còn thiếu: ${missing}`);
        return;
      }
    }

    setLoading(true);
    const token = session.user.access_token;
    const userId = parseInt(session.user.id);

    try {
      let resolvedProductId = productId;
      let skuCode = formState.stockKeepingUnit.replace(/^SKU-/, "");
      const productFiles: File[] = productImageFile ? [productImageFile] : [];

      // Total stock = sum of all variant cells in the matrix
      const totalVariantStock = Object.values(formState.variantMatrix).reduce(
        (sum, cell) => sum + (cell.stock ?? 0),
        0
      );

      // Product price = min price across all variant cells
      const variantPrices = Object.values(formState.variantMatrix).map((cell) => cell.price);
      const minVariantPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;

      if (isEditMode && resolvedProductId) {
        // --- UPDATE PRODUCT ---
        const updateData: UpdateProductDto = {
          name,
          description,
          price: minVariantPrice,
          stock: totalVariantStock,
          stockKeepingUnit: formState.stockKeepingUnit,
          currencyUnit: formState.currencyUnit,
          categoryId: categoryId ?? undefined,
          voucherId: formState.voucherId ?? undefined,
        };

        // If user removed or replaced the image, delete the old media
        if ((imageRemoved || productImageFile) && existingMediaId) {
          updateData.mediaIdsToDelete = [existingMediaId];
        }

        console.log("[ProductForm] Updating product:", updateData, "files:", productFiles.length);
        await productService.updateProduct(resolvedProductId, updateData, productFiles, token);
      } else {
        // --- CREATE PRODUCT ---
        // Fetch a collision-safe 4-digit code from BE before creating
        const skuRes = await productService.generateSku(token);
        const productSku = skuRes?.data?.sku ?? `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
        skuCode = productSku.replace(/^SKU-/, "");
        setFormState((prev) => ({ ...prev, stockKeepingUnit: productSku }));

        const now = new Date().toISOString();
        const createData: CreateProductDto = {
          name,
          description,
          price: minVariantPrice,
          currencyUnit: formState.currencyUnit,
          stockKeepingUnit: productSku,
          stock: totalVariantStock,
          createByUserId: userId,
          categoryId,
          voucherId: formState.voucherId ?? undefined,
          createdAt: now,
          updatedAt: now,
        };
        console.log("[ProductForm] Creating product:", createData, "files:", productFiles.length);
        const productRes = await productService.createProduct(createData, productFiles, token);
        if (!productRes.data) {
          toast.error("Tạo sản phẩm thất bại.");
          setLoading(false);
          return;
        }
        resolvedProductId = productRes.data.id;
        console.log("[ProductForm] Product created with ID:", resolvedProductId);
      }

      // Variant SKU: SKU-{4-digit code}-{SIZE}-C{colorId}
      // skuCode is set above: edit → from existing product SKU, create → from generateSku() response
      const makeSku = (size: string, colorId: number): string =>
        `SKU-${skuCode}-${size.toUpperCase().replace(/\s+/g, "-")}-C${colorId}`;

      // --- HANDLE VARIANTS ---
      const deletePromises: Promise<unknown>[] = [];
      const updatePromises: Promise<unknown>[] = [];
      // Track create calls separately so we can capture returned IDs
      const createEntries: Array<{ key: string; promise: Promise<IBackendRes<unknown>> }> = [];

      const currentKeys = new Set(
        selectedSizes.flatMap((size) =>
          selectedColors.map((color) => `${size}__${color.name}`)
        )
      );

      // DELETE removed variants
      if (isEditMode) {
        for (const key of originalVariantKeys) {
          if (!currentKeys.has(key) && variantIdMap[key]) {
            console.log("[ProductForm] Deleting variant:", key);
            deletePromises.push(
              productVariantService.deleteProductVariant(variantIdMap[key], token)
            );
          }
        }
      }

      // UPDATE existing / CREATE new variants
      for (const size of selectedSizes) {
        for (const color of selectedColors) {
          const key = `${size}__${color.name}`;
          const cell = variantMatrix[key];
          if (!cell) continue;

          const colorImage = colorImages.find((ci) => ci.color === color.name);
          // Only include file in UPDATE if the admin explicitly uploaded a new one (not pre-fetched)
          let files: File[] = (colorImage?.file && !colorImage.isPrefetched) ? [colorImage.file] : [];

          if (isEditMode && originalVariantKeys.has(key) && variantIdMap[key]) {
            const variantId = variantIdMap[key];

            // Backfill image for variants that currently have none in the DB
            if (files.length === 0 && variantsWithoutMedia.has(variantId) && colorImage?.previewUrl) {
              try {
                const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(colorImage.previewUrl)}`);
                const blob = await resp.blob();
                files = [new File([blob], `${color.name}.jpg`, { type: blob.type || "image/jpeg" })];
                console.log("[ProductForm] Backfilling image for variant", variantId);
              } catch (err) {
                console.error("[ProductForm] Failed to fetch proxy image for backfill:", err);
              }
            }

            // --- UPDATE existing variant ---
            console.log("[ProductForm] Updating variant:", key);
            updatePromises.push(
              productVariantService.updateProductVariant(
                variantId,
                {
                  variantName: name,
                  price: cell.price,
                  stock: cell.stock,
                  variantSize: size,
                  variantColor: color.label,
                  colorId: color.id ?? undefined,
                },
                files,
                token
              )
            );
          } else {
            // --- CREATE new variant ---
            // API requires files — use colorImage file if available;
            // if the color only has a previewUrl (existing image from prior save),
            // we need to fetch it as a File so the API accepts the create
            let variantFiles = files;
            if (variantFiles.length === 0 && colorImage?.previewUrl) {
              try {
                const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(colorImage.previewUrl)}`);
                const blob = await resp.blob();
                variantFiles = [new File([blob], `${color.name}.jpg`, { type: blob.type || "image/jpeg" })];
              } catch (err) {
                console.error("[ProductForm] Failed to fetch image via proxy for new variant:", err);
                toast.error(`Không thể tải ảnh cho màu ${color.label}. Vui lòng thử lại.`);
                setLoading(false);
                return;
              }
            }
            const now = new Date().toISOString();
            console.log("[ProductForm] Creating variant:", key, "colorId:", color.id, "productId:", resolvedProductId, "files:", variantFiles.length);
            const variantData: CreateProductVariantDto = {
              productId: resolvedProductId!,
              createByUserId: userId,
              variantName: formState.name,
              variantColor: color.label,
              variantSize: size,
              variantWeight: 250, // grams (matches Prisma schema default)
              variantHeight: 5,   // cm (matches Prisma schema default)
              variantWidth: 20,   // cm (matches Prisma schema default)
              variantLength: 25,  // cm (matches Prisma schema default)
              colorId: color.id ?? 0,
              price: cell.price,
              stock: cell.stock,
              stockKeepingUnit: makeSku(size, color.id ?? 0),
              createdAt: now,
            };
            const createPromise = productVariantService.createProductVariant(variantData, variantFiles, token);
            createEntries.push({ key, promise: createPromise as Promise<IBackendRes<unknown>> });
          }
        }
      }

      // Execute all operations
      const deleteSettled = await Promise.allSettled(deletePromises);
      const deleteErrors = deleteSettled
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => String(r.reason));
      if (deleteErrors.length > 0) {
        toast.error("Không thể xoá một số biến thể vì đã có trong đơn hàng.");
        setLoading(false);
        return;
      }
      await Promise.all(updatePromises);
      const createSettled = await Promise.allSettled(createEntries.map((e) => e.promise));

      // Update variantIdMap and originalVariantKeys with newly created variant IDs
      // so subsequent saves use PATCH instead of POST
      const newIdMap = { ...variantIdMap };
      const newOriginalKeys = new Set(originalVariantKeys);
      const failedCreates: string[] = [];
      createSettled.forEach((result, i) => {
        const entry = createEntries[i];
        if (result.status === "rejected") {
          console.error("[ProductForm] Failed to create variant", entry.key, ":", result.reason);
          failedCreates.push(entry.key);
          return;
        }
        const data = result.value?.data as { id?: number } | undefined;
        if (data?.id) {
          newIdMap[entry.key] = data.id;
          newOriginalKeys.add(entry.key);
          console.log("[ProductForm] Created variant", entry.key, "with ID:", data.id);
        }
      });
      setVariantIdMap(newIdMap);
      setOriginalVariantKeys(newOriginalKeys);
      // All missing images have been backfilled — reset tracker
      setVariantsWithoutMedia(new Set());

      console.log("[ProductForm] All operations complete");
      if (failedCreates.length > 0) {
        toast.error(`Một số sản phẩm con tạo thất bại: ${failedCreates.join(", ")}`);
      } else if (onSuccess) {
        onSuccess();
      } else if (isEditMode) {
        toast.success("Lưu thành công.");
      } else {
        router.push(`/admin/products/edit/${resolvedProductId}`);
      }
    } catch (error) {
      console.error("[ProductForm] Error:", error);
      toast.error(isEditMode ? "Có lỗi xảy ra khi cập nhật sản phẩm." : "Có lỗi xảy ra khi tạo sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.user?.access_token || !productId) return;
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) return;

    setLoading(true);
    try {
      await productService.deleteProduct(productId, session.user.access_token);
      console.log("[ProductForm] Product deleted");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin/products/list");
      }
    } catch (error) {
      console.error("[ProductForm] Error deleting:", error);
      toast.error("Có lỗi xảy ra khi xóa sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className={`flex items-center justify-center gap-2 text-gray-500 ${isModal ? "py-16" : "p-8 bg-gray-50 min-h-screen"}`}>
        <Loader2 size={20} className="animate-spin" />
        <span>Đang tải...</span>
      </div>
    );
  }

  const formBody = (
    <>
      {/* Two-column grid */}
      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 mb-6${stockOnly ? " pointer-events-none opacity-60" : ""}`}>
        <ProductBasicInfoCard
          formState={formState}
          onFieldChange={handleFieldChange}
        />
        <ProductImageCard
          formState={formState}
          categories={categories}
          onFieldChange={handleFieldChange}
          productImageFile={productImageFile}
          productImagePreview={productImagePreview}
          onProductImageChange={handleProductImageChange}
          onProductImageRemove={handleProductImageRemove}
        />
      </div>

      {/* Variant matrix */}
      <div className="mb-6">
        <VariantMatrixSection
          formState={formState}
          apiColors={apiColors}
          onFieldChange={handleFieldChange}
          onAddColor={handleAddColor}
          onMatrixCellChange={handleMatrixCellChange}
          onCreateColor={handleCreateColor}
          onUpdateColor={handleUpdateColor}
          onDeleteColor={handleDeleteColor}
          stockOnly={stockOnly}
        />
      </div>

      {/* Color image upload */}
      <div className={`mb-6${stockOnly ? " pointer-events-none opacity-60" : ""}`}>
        <ColorImageUploadSection
          formState={formState}
          onColorImageChange={handleColorImageChange}
          onColorImageRemove={handleColorImageRemove}
        />
      </div>
    </>
  );

  if (isModal) {
    return (
      <div className="p-3 sm:p-4 md:p-6 min-w-0 w-full overflow-x-hidden">
        {formBody}
        {/* Modal footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-200">
          <div>
            {isEditMode && !stockOnly && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="cursor-pointer"
              >
                Xóa sản phẩm
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="cursor-pointer"
            >
              {loading ? "Đang lưu..." : stockOnly ? "Lưu tồn kho" : isEditMode ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--admin-green-dark)]">
          {isEditMode ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
        </h1>
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#4ea674] hover:bg-[#3d8a5f] text-white px-6 cursor-pointer w-full sm:w-auto"
        >
          {loading ? "Đang lưu..." : isEditMode ? "Lưu thay đổi" : "Đăng tải sản phẩm"}
        </Button>
      </div>

      {formBody}

      {/* Save / Delete actions */}
      <ProductFormActions
        mode={isEditMode ? "edit" : "add"}
        loading={loading}
        onSave={handleSave}
        onDelete={isEditMode ? handleDelete : undefined}
      />
    </div>
  );
}
