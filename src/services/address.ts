import { sendRequest } from "@/utils/api";
import type {
  CreateAddressDto,
  UpdateAddressDto,
  AddressDto,
  AddressWithMeta,
  CreateAddressForOrderResponseDto,
} from "@/dto/address";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const addressService = {
  /**
   * Create a new address
   */
  async createAddress(data: CreateAddressDto, accessToken: string): Promise<IBackendRes<AddressDto>> {
    const url = `${BACKEND_URL}/address`;
    // console.log("[AddressService] Creating address:", data);
    const response = await sendRequest<IBackendRes<AddressDto>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[AddressService] Create address response:", response);
    return response;
  },

  /**
   * Create order address — validates with GHN and returns DB address + GHN location data
   * POST /address/order-address
   */
  async createOrderAddress(
    data: CreateAddressDto,
    accessToken: string
  ): Promise<IBackendRes<CreateAddressForOrderResponseDto>> {
    const url = `${BACKEND_URL}/address/order-address`;
    // console.log("[AddressService] Creating order address:", data);
    const response = await sendRequest<IBackendRes<CreateAddressForOrderResponseDto>>({
      url,
      method: "POST",
      body: data,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // console.log("[AddressService] Create order address response:", response);
    return response;
  },

  /**
   * Get all addresses for a specific user
   * @param userId User ID to fetch addresses for
   * @param accessToken Bearer authentication token
   * @returns Backend response with array of addresses
   */
  async getUserAddresses(userId: number, accessToken: string): Promise<IBackendRes<AddressWithMeta[]>> {
    const url = `${BACKEND_URL}/user/${userId}/address-list`;
    // console.log("[AddressService] Fetching addresses for user:", userId);
    const response = await sendRequest<IBackendRes<AddressDto[]>>({
      url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[AddressService] Get user addresses response:", response);
    return response;
  },

  /**
   * Get a specific address by ID
   * @param addressId Address ID to fetch
   * @param accessToken Bearer authentication token
   * @returns Backend response with AddressDto
   */
  async getAddressById(addressId: number, accessToken: string): Promise<IBackendRes<AddressDto>> {
    const url = `${BACKEND_URL}/address/${addressId}`;
    // console.log("[AddressService] Fetching address:", addressId);
    const response = await sendRequest<IBackendRes<AddressDto>>({
      url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[AddressService] Get address response:", response);
    return response;
  },

  /**
   * Update an existing address
   * @param addressId Address ID to update
   * @param data Address update data
   * @param accessToken Bearer authentication token
   * @returns Backend response with updated AddressDto
   */
  async updateAddress(addressId: number, data: UpdateAddressDto, accessToken: string): Promise<IBackendRes<AddressDto>> {
    const url = `${BACKEND_URL}/address/${addressId}`;
    // console.log("[AddressService] Updating address:", { addressId, data });
    const response = await sendRequest<IBackendRes<AddressDto>>({
      url,
      method: "PATCH",
      body: data,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[AddressService] Update address response:", response);
    return response;
  },

  /**
   * Delete an address
   * @param addressId Address ID to delete
   * @param accessToken Bearer authentication token
   * @returns Backend response confirming deletion
   */
  async deleteAddress(addressId: number, accessToken: string): Promise<IBackendRes<void>> {
    const url = `${BACKEND_URL}/address/${addressId}`;
    // console.log("[AddressService] Deleting address:", addressId);
    const response = await sendRequest<IBackendRes<void>>({
      url,
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // console.log("[AddressService] Delete address response:", response);
    return response;
  },
};
