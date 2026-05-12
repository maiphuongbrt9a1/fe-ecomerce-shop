import { sendRequest } from "@/utils/api";
import type { OutfitRecommendationVariantDto } from "@/dto/recommendation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const recommendationService = {
  getOutfitRecommendation(variantId: number): Promise<IBackendRes<OutfitRecommendationVariantDto[]>> {
    const url = `${BACKEND_URL}/recommendation/outfit/${variantId}`;
    // console.log("[RecommendationService] Fetching outfit recommendation for variant:", variantId);
    return sendRequest<IBackendRes<OutfitRecommendationVariantDto[]>>({
      url,
      method: "GET",
    });
  },
};
