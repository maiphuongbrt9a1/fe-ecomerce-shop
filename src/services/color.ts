import { sendRequest } from "@/utils/api";
import type { ColorEntity, CreateColorDto, UpdateColorDto } from "@/dto/color";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const colorService = {
  async getAllColors(accessToken?: string): Promise<IBackendRes<ColorEntity[]>> {
    const url = `${BACKEND_URL}/color`;
    // console.log("[ColorService] Fetching all colors");
    const response = await sendRequest<IBackendRes<ColorEntity[]>>({
      url,
      method: "GET",
      queryParams: { perPage: 100, page: 1 },
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
    // console.log("[ColorService] Colors response:", response);
    return response;
  },

  async createColor(
    data: CreateColorDto,
    accessToken: string
  ): Promise<IBackendRes<ColorEntity>> {
    const url = `${BACKEND_URL}/color`;
    // console.log("[ColorService] Creating color:", data);
    const response = await sendRequest<IBackendRes<ColorEntity>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ColorService] Create color response:", response);
    return response;
  },

  async updateColor(
    id: number,
    data: UpdateColorDto,
    accessToken: string
  ): Promise<IBackendRes<ColorEntity>> {
    const url = `${BACKEND_URL}/color/${id}`;
    // console.log("[ColorService] Updating color:", { id, data });
    const response = await sendRequest<IBackendRes<ColorEntity>>({
      url,
      method: "PATCH",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ColorService] Update color response:", response);
    return response;
  },

  async deleteColor(
    id: number,
    accessToken: string
  ): Promise<IBackendRes<ColorEntity>> {
    const url = `${BACKEND_URL}/color/${id}`;
    // console.log("[ColorService] Deleting color:", id);
    const response = await sendRequest<IBackendRes<ColorEntity>>({
      url,
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ColorService] Delete color response:", response);
    return response;
  },
};
