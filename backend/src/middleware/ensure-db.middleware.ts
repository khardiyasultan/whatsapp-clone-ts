
import type { RequestHandler } from "express";
import { connectDB } from "../config/db.js";

export const ensureDB: RequestHandler = async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(503).json({
      success: false,
      message: "Database unavailable. Please try again later."
    });
  }
};
