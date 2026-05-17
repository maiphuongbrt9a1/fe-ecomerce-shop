import { sendRequest, sendRequestFile } from "@/utils/api";

export type UserRole = "ADMIN" | "OPERATOR" | "USER";

export interface UserMediaDto {
  id: number;
  url: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  isAvatarFile: boolean;
  isShopLogo: boolean;
  isShopBanner: boolean;
  isCategoryFile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  id: number;
  name?: string;
  email: string;
  phone?: string;
  username?: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  image?: string;
  role?: UserRole;
  isActive?: boolean;
  status?: "ACTIVE" | "INACTIVE" | "VIP";
  createdAt?: string;
}

export interface UserFullDto extends UserDto {
  userMedia: UserMediaDto[];
}

export interface UserOrderStatsDto {
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  totalSpend: number;
}

export interface IUpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  username?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  role?: UserRole;
}

/** Extract avatar URL from userMedia array */
export function getAvatarUrl(userMedia?: UserMediaDto[]): string | undefined {
  return userMedia?.find((m) => m.isAvatarFile)?.url;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const userService = {
  getAll: (accessToken?: string) =>
    sendRequest<IBackendRes<UserDto[]>>({
      url: `${BASE_URL}/user`,
      method: "GET",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }),

  getAllUsers: (accessToken: string) =>
    sendRequest<IBackendRes<UserDto[]>>({
      url: `${BASE_URL}/user?page=1&perPage=9999`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  getUsers: (page: number, perPage: number, accessToken: string) =>
    sendRequest<IBackendRes<UserDto[]>>({
      url: `${BASE_URL}/user`,
      method: "GET",
      queryParams: { page, perPage },
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  getUser: (id: string, accessToken: string) =>
    sendRequest<IBackendRes<UserDto>>({
      url: `${BASE_URL}/user/${id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  /** Fetch full user profile including userMedia (avatar URL) */
  getUserWithMedia: (id: string | number, accessToken: string) =>
    sendRequest<IBackendRes<UserFullDto>>({
      url: `${BASE_URL}/user/${id}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  /** Aggregate order stats — one BE call instead of paginating every order */
  getUserOrderStats: (id: string | number, accessToken: string) =>
    sendRequest<IBackendRes<UserOrderStatsDto>>({
      url: `${BASE_URL}/user/${id}/order-stats`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  updateUser: (
    id: string,
    data: IUpdateUserDto,
    accessToken: string,
    file?: File
  ) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) formData.append(key, String(value));
    }
    if (file) formData.append("file", file);
    return sendRequestFile<IBackendRes<UserFullDto>>({
      url: `${BASE_URL}/user/${id}`,
      method: "PATCH",
      body: formData,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};

export type UserServiceType = typeof userService;
