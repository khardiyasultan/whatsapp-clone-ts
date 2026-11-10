import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./api";

export type ServerMessage = {
  _id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  text: string;
  createdAt: string;
  status: "sent" | "delivered" | "read";
};

export type MessageStatusUpdate = {
  messageId: string;
  status: "sent" | "delivered" | "read";
};

export type ServerToClientEvents = {
  "message:new": (message: ServerMessage) => void;
  "message:status": (data: MessageStatusUpdate) => void;

  "conversation:new": (data: { conversationId: string }) => void;

  "presence:update": (data: { userId: string; isOnline: boolean }) => void;
};

export type ClientToServerEvents = {
  "conversation:join": (
    data: { conversationId: string },
    callback?: (response: {
      success: boolean;
      message: string;
      conversationId?: string;
    }) => void,
  ) => void;

  "conversation:leave": (data: { conversationId: string }) => void;

  "message:delivered": (
    data: { messageId: string },
    callback?: (response: {
      success: boolean;
      message: string;
      data?: {
        messageId: string;
        status: "sent" | "delivered" | "read";
      };
    }) => void,
  ) => void;

  "message:read": (
    data: { messageId: string },
    callback?: (response: {
      success: boolean;
      message: string;
      data?: {
        messageId: string;
        status: "sent" | "delivered" | "read";
      };
    }) => void,
  ) => void;

  "presence:request": (
    callback: (response: { success: boolean; onlineUserIds: string[] }) => void,
  ) => void;
};

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ChatSocket | null = null;

export function connectSocket(): ChatSocket {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Cannot connect Socket.IO without an access token.");
  }

  if (socket) {
    if (!socket.connected && !socket.active) {
      socket.auth = { token };
      socket.connect();
    }

    return socket;
  }

  socket = io("http://localhost:4000", {
    auth: { token },
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
