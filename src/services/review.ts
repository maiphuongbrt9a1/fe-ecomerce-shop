import { sendRequest } from "@/utils/api";
import type { AdminReviewDto } from "@/dto/review";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const reviewService = {
  async getAllReviews(
    page = 1,
    perPage = 20,
    rating: number | undefined,
    accessToken: string,
    search?: string,
  ): Promise<IBackendRes<AdminReviewDto[]>> {
    const queryParams: Record<string, string | number> = { page, perPage };
    if (rating != null) queryParams.rating = rating;
    const trimmed = search?.trim();
    if (trimmed) queryParams.search = trimmed;

    const url = `${BACKEND_URL}/reviews`;
    const response = await sendRequest<IBackendRes<AdminReviewDto[]>>({
      url,
      method: "GET",
      queryParams,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response;
  },

  async deleteReview(
    reviewId: number,
    accessToken: string
  ): Promise<IBackendRes<void>> {
    const url = `${BACKEND_URL}/reviews/${reviewId}`;
    // console.log("[ReviewService] Deleting review:", reviewId);
    const response = await sendRequest<IBackendRes<void>>({
      url,
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[ReviewService] Delete review response:", response);
    return response;
  },
};
