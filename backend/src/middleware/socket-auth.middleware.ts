
import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import RefreshTokenModel from "../models/refresh-token.model.js";
import { JWT_SECRET } from "../config/jwt.js";

interface SocketAuthPayload extends jwt.JwtPayload {
  userId: string;
  sid: string;
}

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

export async function authenticateSocket(
  socket: AuthenticatedSocket,
  next: (error?: Error) => void
): Promise<void> {
  const token: unknown = socket.handshake.auth?.token;

  if (typeof token !== "string" || token.trim().length === 0) {
    next(new Error("Authentication token is required"));
    return;
  }

  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    next(new Error("Invalid or expired authentication token"));
    return;
  }

  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.sid !== "string" ||
    !mongoose.isValidObjectId(payload.sid)
  ) {
    next(new Error("Invalid authentication token"));
    return;
  }

  try {
    const activeSession = await RefreshTokenModel.findOne({
      familyId: payload.sid,
      usedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    })
      .select("_id")
      .lean();

    if (!activeSession) {
      next(new Error("Session is no longer active"));
      return;
    }

    socket.userId = payload.userId;
    socket.sessionId = payload.sid;

    next();
  } catch (error) {
    console.error("Socket session validation failed:", error);
    next(new Error("Unable to validate session"));
  }
}
