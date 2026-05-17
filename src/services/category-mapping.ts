import { sendRequest } from "@/utils/api";
import type {
  CategoryMappingCountDto,
  CategoryMappingDto,
  SyncCategoryMappingDto,
} from "@/dto/category-mapping";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const categoryMappingService = {
  async getAll(accessToken: string): Promise<IBackendRes<CategoryMappingDto[]>> {
    const url = `${BACKEND_URL}/category-mapping`;
    const response = await sendRequest<IBackendRes<CategoryMappingDto[]>>({
      url,
      method: "GET",
      queryParams: { perPage: 1000 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async getByBase(
    baseCategoryId: number,
    accessToken: string,
  ): Promise<IBackendRes<CategoryMappingDto[]>> {
    const url = `${BACKEND_URL}/category-mapping`;
    const response = await sendRequest<IBackendRes<CategoryMappingDto[]>>({
      url,
      method: "GET",
      queryParams: { baseCategoryId, perPage: 200 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log(
      "[CategoryMappingService] getByBase response:",
      baseCategoryId,
      response,
    );
    return response;
  },

  async getCounts(
    accessToken: string,
  ): Promise<IBackendRes<CategoryMappingCountDto[]>> {
    const url = `${BACKEND_URL}/category-mapping/counts`;
    const response = await sendRequest<IBackendRes<CategoryMappingCountDto[]>>({
      url,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async sync(
    payload: SyncCategoryMappingDto,
    accessToken: string,
  ): Promise<IBackendRes<CategoryMappingDto[]>> {
    const url = `${BACKEND_URL}/category-mapping/sync`;
    console.log("[CategoryMappingService] sync request:", payload);
    const response = await sendRequest<IBackendRes<CategoryMappingDto[]>>({
      url,
      method: "PUT",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log("[CategoryMappingService] sync response:", response);
    return response;
  },
};
