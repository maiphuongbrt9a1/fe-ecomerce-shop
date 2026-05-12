import { sendRequest } from "@/utils/api";
import type { CategoryDto, CreateCategoryDto } from "@/dto/category";
import type { ProductDto } from "@/dto/product";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const categoryService = {
  async getAllCategories(accessToken?: string): Promise<IBackendRes<CategoryDto[]>> {
    const url = `${BACKEND_URL}/category`;
    // console.log("[CategoryService] Fetching all categories");
    const response = await sendRequest<IBackendRes<CategoryDto[]>>({
      url,
      method: "GET",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    // console.log("[CategoryService] Categories response:", response);
    return response;
  },

  async getCategoriesPage(page: number, perPage: number, accessToken?: string): Promise<IBackendRes<CategoryDto[]>> {
    const url = `${BACKEND_URL}/category?page=${page}&perPage=${perPage}`;
    const response = await sendRequest<IBackendRes<CategoryDto[]>>({
      url,
      method: "GET",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    return response;
  },

  async getCategoryById(id: number, accessToken?: string): Promise<IBackendRes<CategoryDto>> {
    const url = `${BACKEND_URL}/category/${id}`;
    // console.log("[CategoryService] Fetching category:", id);
    const response = await sendRequest<IBackendRes<CategoryDto>>({
      url,
      method: "GET",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    // console.log("[CategoryService] Category response:", response);
    return response;
  },

  async createCategory(data: CreateCategoryDto, accessToken: string): Promise<IBackendRes<CategoryDto>> {
    const url = `${BACKEND_URL}/category`;
    // console.log("[CategoryService] Creating category:", data);
    const response = await sendRequest<IBackendRes<CategoryDto>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[CategoryService] Create category response:", response);
    return response;
  },

  async getProductsByCategory(
    categoryId: number,
    params?: { page?: number; perPage?: number },
    accessToken?: string
  ): Promise<IBackendRes<ProductDto[]>> {
    const url = `${BACKEND_URL}/category/${categoryId}/products`;
    // console.log("[CategoryService] Fetching products for category:", categoryId);
    const response = await sendRequest<IBackendRes<ProductDto[]>>({
      url,
      method: "GET",
      queryParams: { page: params?.page ?? 1, perPage: params?.perPage ?? 100 },
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    // console.log("[CategoryService] Category products response:", response);
    return response;
  },
};
