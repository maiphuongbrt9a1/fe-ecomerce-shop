import { sendRequest } from "@/utils/api";
import type { CreateReturnRequestDto, ReturnRequestEntity, ReturnRequestStatus } from "@/dto/returnRequest";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export interface UpdateReturnRequestStatusPayload {
  processByStaffId: number;
  status: Extract<ReturnRequestStatus, "IN_PROGRESS" | "APPROVED" | "REJECTED">;
}

export const returnRequestService = {
  create(data: CreateReturnRequestDto, accessToken: string): Promise<IBackendRes<ReturnRequestEntity>> {
    // console.log("[ReturnRequestService] Creating return request:", data);
    return sendRequest<IBackendRes<ReturnRequestEntity>>({
      url: `${BASE_URL}/return-requests`,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  updateStatus(
    id: number,
    payload: UpdateReturnRequestStatusPayload,
    accessToken: string,
  ): Promise<IBackendRes<ReturnRequestEntity>> {
    // console.log("[ReturnRequestService] Updating status:", id, payload);
    return sendRequest<IBackendRes<ReturnRequestEntity>>({
      url: `${BASE_URL}/return-requests/${id}`,
      method: "PATCH",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
