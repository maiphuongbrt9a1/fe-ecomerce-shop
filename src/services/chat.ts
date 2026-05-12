import { sendRequest } from "@/utils/api";
import {
  AddUserToRoomDto,
  ChatMessageDto,
  ChatRoomDto,
  CreateMessageDto,
  CreatePrivateMessageDto,
  CreateRoomDto,
  JoinRoomDto,
} from "@/dto/chat";

// Use Next.js rewrite proxy to avoid CORS on browser requests.
// next.config.ts maps /api/proxy/chat/* → BACKEND_URL/chat/*
const CHAT_BASE = "/api/proxy/chat";

export const chatService = {
  getAllRooms(accessToken: string) {
    // console.log("[chatService] Request: GET /chat/rooms");
    return sendRequest<IBackendRes<ChatRoomDto[]>>({
      url: `${CHAT_BASE}/rooms`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getRoomMessages(
    roomName: string,
    accessToken: string,
    page = 1,
    perPage = 30
  ) {
    // console.log("[chatService] Request: GET /chat/messages", { roomName, page, perPage });
    return sendRequest<IBackendRes<ChatMessageDto[]>>({
      url: `${CHAT_BASE}/messages?roomName=${encodeURIComponent(roomName)}&page=${page}&perPage=${perPage}`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  createPublicRoom(payload: CreateRoomDto, accessToken: string) {
    // console.log("[chatService] Request: POST /chat/public-rooms", payload);
    return sendRequest<IBackendRes<ChatRoomDto>>({
      url: `${CHAT_BASE}/public-rooms`,
      method: "POST",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  joinPublicRoom(payload: JoinRoomDto, accessToken: string) {
    // console.log("[chatService] Request: POST /chat/public-rooms/join", payload);
    return sendRequest<IBackendRes<{ joined: boolean; roomName: string }>>({
      url: `${CHAT_BASE}/public-rooms/join`,
      method: "POST",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  sendPublicMessage(payload: CreateMessageDto, accessToken: string) {
    // console.log("[chatService] Request: POST /chat/messages/public", payload);
    return sendRequest<IBackendRes<ChatMessageDto>>({
      url: `${CHAT_BASE}/messages/public`,
      method: "POST",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  sendPrivateMessage(payload: CreatePrivateMessageDto, accessToken: string) {
    // console.log("[chatService] Request: POST /chat/messages/private", payload);
    return sendRequest<IBackendRes<ChatMessageDto>>({
      url: `${CHAT_BASE}/messages/private`,
      method: "POST",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  addUserToRoom(payload: AddUserToRoomDto, accessToken: string) {
    // console.log("[chatService] Request: POST /chat/public-rooms/add-user", payload);
    return sendRequest<IBackendRes<{ joined: boolean; roomName: string }>>({
      url: `${CHAT_BASE}/public-rooms/add-user`,
      method: "POST",
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  getAdminRooms(accessToken: string) {
    // console.log("[chatService] Request: GET /chat/admin/rooms");
    return sendRequest<IBackendRes<ChatRoomDto[]>>({
      url: `${CHAT_BASE}/admin/rooms`,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
};
