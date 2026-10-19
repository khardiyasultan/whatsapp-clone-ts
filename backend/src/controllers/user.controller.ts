
import type { Response } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import UserModel from "../models/user.model.js";

export async function updateProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const { name, about } = req.body as {
      name?: unknown;
      about?: unknown;
    };

    const updates: { name?: string; about?: string } = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length === 0 ||
        name.trim().length > 50
      ) {
        res.status(400).json({
          success: false,
          message: "Name must be between 1 and 50 characters"
        });
        return;
      }

      updates.name = name.trim();
    }

    if (about !== undefined) {
      if (typeof about !== "string" || about.length > 139) {
        res.status(400).json({
          success: false,
          message: "About must be a string of at most 139 characters"
        });
        return;
      }

      updates.about = about.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide a name or about field to update"
      });
      return;
    }

    const user = await UserModel.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    ).select("name email about profilePhoto");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    console.error("Profile update failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update profile"
    });
  }
}



export async function searchUsers(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const query = req.query.q;

    if (typeof query !== "string" || query.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Search query must contain at least 2 characters"
      });
      return;
    }

    if (!req.userId || !mongoose.isValidObjectId(req.userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const searchTerm = query.trim();

    const users = await UserModel.find({
      _id: { $ne: req.userId },
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } }
      ]
    })
      .select("_id name profilePhoto about")
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error("User search failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to search users"
    });
  }
}
