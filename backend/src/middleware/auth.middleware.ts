import RefreshTokenModel from "../models/refresh-token.model.js";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { JWT_SECRET } from "../config/jwt.js";

export interface AuthRequest extends Request {
  userId?: string;
  sessionId?: string;
}



export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication token is required"
    });
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token"
    });
    return;
  }

  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.sid !== "string" ||
    !mongoose.isValidObjectId(payload.sid)
  ) {
    res.status(401).json({
      success: false,
      message: "Invalid authentication token"
    });
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
      res.status(401).json({
        success: false,
        message: "Session is no longer active"
      });
      return;
    }

    req.userId = payload.userId;
    req.sessionId = payload.sid;

    next();
  } catch (error) {
    console.error("Session validation failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to validate session"
    });
  }
}