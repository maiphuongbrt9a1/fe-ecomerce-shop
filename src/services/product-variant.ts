import { sendRequest, sendRequestFile } from "@/utils/api";
import type {
  ProductVariantEntity,
  ProductVariantWithMediaAndProductEntity,
  CreateProductVariantDto,
  UpdateProductVariantDto,
} from "@/dto/product-variant";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const productVariantService = {
  async createProductVariant(data: CreateProductVariantDto, files: File[], accessToken: string): Promise<IBackendRes<ProductVariantEntity>> {
    const url = `${BACKEND_URL}/product-variants`;
    // console.log("[ProductVariantService] Creating product variant:", data);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("productId", data.productId.toString());
    formData.append("createByUserId", data.createByUserId.toString());
    formData.append("variantName", data.variantName);
    formData.append("variantColor", data.variantColor);
    formData.append("variantSize", data.variantSize);
    formData.append("variantWeight", data.variantWeight.toString());
    formData.append("variantHeight", data.variantHeight.toString());
    formData.append("variantLength", data.variantLength.toString());
    formData.append("variantWidth", data.variantWidth.toString());
    formData.append("colorId", data.colorId.toString());
    formData.append("price", data.price.toString());
    formData.append("stock", data.stock.toString());
    formData.append("stockKeepingUnit", data.stockKeepingUnit);
    formData.append("createdAt", data.createdAt);
    if (data.voucherId) {
      formData.append("voucherId", data.voucherId.toString());
    }

    // console.log("[ProductVariantService] FormData files count:", files.length);

    const response = await sendRequestFile<IBackendRes<ProductVariantEntity>>({
      url,
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductVariantService] Create product variant response:", response);
    return response;
  },

  async updateProductVariant(
    id: number,
    data: UpdateProductVariantDto,
    files: File[],
    accessToken: string
  ): Promise<IBackendRes<ProductVariantEntity>> {
    const url = `${BACKEND_URL}/product-variants/${id}`;
    // console.log("[ProductVariantService] Updating product variant:", { id, data });

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const entries = Object.entries(data) as [keyof UpdateProductVariantDto, unknown][];
    for (const [key, value] of entries) {
      if (value === undefined) continue;
      if (key === "mediaIdsToDelete" && Array.isArray(value)) {
        (value as string[]).forEach((mediaId) => {
          formData.append("mediaIdsToDelete", mediaId);
        });
      } else {
        formData.append(key, String(value));
      }
    }

    const response = await sendRequestFile<IBackendRes<ProductVariantEntity>>({
      url,
      method: "PATCH",
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductVariantService] Update product variant response:", response);
    return response;
  },

  async deleteProductVariant(id: number, accessToken: string): Promise<IBackendRes<void>> {
    const url = `${BACKEND_URL}/product-variants/${id}`;
    // console.log("[ProductVariantService] Deleting product variant:", id);
    const response = await sendRequest<IBackendRes<void>>({
      url,
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductVariantService] Delete product variant response:", response);
    return response;
  },

  async getAllProductVariants(
    params: { page?: number; perPage?: number; search?: string; accessToken?: string } = {}
  ): Promise<IBackendRes<ProductVariantWithMediaAndProductEntity[]>> {
    const { page = 1, perPage = 10, search, accessToken } = params;
    const url = `${BACKEND_URL}/product-variants`;
    const queryParams: Record<string, string | number> = { page, perPage };
    if (search && search.trim()) queryParams.search = search.trim();
    const response = await sendRequest<IBackendRes<ProductVariantWithMediaAndProductEntity[]>>({
      url,
      method: "GET",
      queryParams,
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    return response;
  },

  async getProductVariantById(id: number, accessToken?: string): Promise<IBackendRes<ProductVariantEntity>> {
    const url = `${BACKEND_URL}/product-variants/${id}`;
    // console.log("[ProductVariantService] Fetching product variant:", id);
    const response = await sendRequest<IBackendRes<ProductVariantEntity>>({
      url,
      method: "GET",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    // console.log("[ProductVariantService] Product variant response:", response);
    return response;
  },
};
