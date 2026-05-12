import { sendRequest, sendRequestFile } from "@/utils/api";
import type { ProductDto, ProductVariantWithMediaEntity, PaginatedProductsResponse, GetProductsParams, GetFilterParams, CreateProductDto, UpdateProductDto } from "@/dto/product";
import type { ProductDetailDto, ReviewDto, CreateReviewDto, UpdateReviewDto } from "@/dto/product-detail";
import type { ProductVariantEntity } from "@/dto/product-variant";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const productService = {
  async createProduct(data: CreateProductDto, files: File[], accessToken: string): Promise<IBackendRes<ProductDto>> {
    const url = `${BACKEND_URL}/products`;
    // console.log("[ProductService] Creating product:", data);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const entries = Object.entries(data) as [keyof CreateProductDto, unknown][];
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      formData.append(key, String(value));
    }

    const response = await sendRequestFile<IBackendRes<ProductDto>>({
      url,
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductService] Create product response:", response);
    return response;
  },

  async getAllProducts(
    params: GetProductsParams & { accessToken?: string }
  ): Promise<IBackendRes<ProductDto[]>> {
    const { page = 1, perPage = 20, accessToken } = params;
    const url = `${BACKEND_URL}/products`;
    // console.log("[ProductService] Fetching all products:", { page, perPage });
    const response = await sendRequest<IBackendRes<ProductDto[]>>({
      url,
      method: "GET",
      queryParams: { page, perPage },
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
    });
    // console.log("[ProductService] Products response:", response);
    return response;
  },

  async getProductById(id: string, accessToken?: string): Promise<IBackendRes<ProductDto>> {
    const url = `${BACKEND_URL}/products/${id}`;
    // console.log("[ProductService] Fetching product by id:", id);
    const response = await sendRequest<IBackendRes<ProductDto>>({
      url,
      method: "GET",
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
    });
    // console.log("[ProductService] Product detail response:", response);
    return response;
  },

  async getProductVariants(productId: string, accessToken?: string): Promise<IBackendRes<ProductVariantEntity[]>> {
    const url = `${BACKEND_URL}/products/${productId}/product-variants`;
    // console.log("[ProductService] Fetching variants for product:", productId);
    const response = await sendRequest<IBackendRes<ProductVariantEntity[]>>({
      url,
      method: "GET",
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
    });
    // console.log("[ProductService] Variants response:", response);
    return response;
  },

  async getProductReviews(productId: string, accessToken?: string): Promise<IBackendRes<ReviewDto[]>> {
    const url = `${BACKEND_URL}/products/${productId}/reviews`;
    // console.log("[ProductService] Fetching reviews for product:", productId);
    const response = await sendRequest<IBackendRes<ReviewDto[]>>({
      url,
      method: "GET",
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
    });
    // console.log("[ProductService] Reviews response:", response);
    return response;
  },

  async createReview(
    data: CreateReviewDto,
    files: File[],
    accessToken: string
  ): Promise<IBackendRes<ReviewDto>> {
    const url = `${BACKEND_URL}/reviews`;
    // console.log("[ProductService] Creating review with", files.length, "file(s):", data);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    Object.entries(data).forEach(([k, v]) => {
      if (v == null) return;
      formData.append(k, String(v));
    });

    const response = await sendRequestFile<IBackendRes<ReviewDto>>({
      url,
      method: "POST",
      body: formData,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ProductService] Create review response:", response);
    return response;
  },

  async updateReview(
    reviewId: number,
    data: UpdateReviewDto,
    files: File[],
    mediaIdsToDelete: string[],
    accessToken: string
  ): Promise<IBackendRes<ReviewDto>> {
    const url = `${BACKEND_URL}/reviews/${reviewId}`;
    // console.log("[ProductService] Updating review:", { reviewId, data, files: files.length, mediaIdsToDelete });

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    mediaIdsToDelete.forEach((id) => formData.append("mediaIdsToDelete", id));
    Object.entries(data).forEach(([k, v]) => {
      if (v == null) return;
      formData.append(k, String(v));
    });

    const response = await sendRequestFile<IBackendRes<ReviewDto>>({
      url,
      method: "PATCH",
      body: formData,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ProductService] Update review response:", response);
    return response;
  },

  async deleteReview(reviewId: number, accessToken: string): Promise<IBackendRes<void>> {
    const url = `${BACKEND_URL}/reviews/${reviewId}`;
    // console.log("[ProductService] Deleting review:", reviewId);
    const response = await sendRequest<IBackendRes<void>>({
      url,
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductService] Delete review response:", response);
    return response;
  },

  async updateProduct(id: number, data: UpdateProductDto, files: File[], accessToken: string): Promise<IBackendRes<ProductDto>> {
    const url = `${BACKEND_URL}/products/${id}`;
    // console.log("[ProductService] Updating product:", { id, data });

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const entries = Object.entries(data) as [keyof UpdateProductDto, unknown][];
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      if (key === "mediaIdsToDelete" && Array.isArray(value)) {
        (value as string[]).forEach((mediaId) => formData.append("mediaIdsToDelete", mediaId));
      } else {
        formData.append(key, String(value));
      }
    }

    const response = await sendRequestFile<IBackendRes<ProductDto>>({
      url,
      method: "PATCH",
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductService] Update product response:", response);
    return response;
  },

  async filterProducts(params: GetFilterParams): Promise<IBackendRes<ProductVariantWithMediaEntity[]>> {
    const { page = 1, perPage = 20, searchText, categories, colors, sizes, priceRange, conditions, features, accessToken } = params;
    const url = `${BACKEND_URL}/products/filter`;
    const queryParams: Record<string, string | number | boolean | string[] | number[]> = { page, perPage };
    if (searchText) queryParams.searchText = searchText;
    if (categories?.length) queryParams.categories = categories;
    if (colors?.length) queryParams.colors = colors;
    if (sizes?.length) queryParams.sizes = sizes;
    if (priceRange) queryParams.priceRange = priceRange;
    if (conditions?.length) queryParams.conditions = conditions;
    if (features?.length) queryParams.features = features;
    // console.log("[ProductService] Filtering products:", queryParams);
    const response = await sendRequest<IBackendRes<ProductVariantWithMediaEntity[]>>({
      url,
      method: "GET",
      queryParams: queryParams as Record<string, string | number | boolean>,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    // console.log("[ProductService] Filter response:", response?.data?.length, "variants");
    return response;
  },

  async generateSku(accessToken: string): Promise<IBackendRes<{ sku: string }>> {
    const url = `${BACKEND_URL}/products/generate-sku`;
    const response = await sendRequest<IBackendRes<{ sku: string }>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async deleteProduct(id: number, accessToken: string): Promise<IBackendRes<void>> {
    const url = `${BACKEND_URL}/products/${id}`;
    // console.log("[ProductService] Deleting product:", id);
    const response = await sendRequest<IBackendRes<void>>({
      url,
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[ProductService] Delete product response:", response);
    return response;
  },
};

export type ProductServiceType = typeof productService;
