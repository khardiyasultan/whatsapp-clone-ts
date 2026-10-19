
import mongoose, { Types } from "mongoose";
import RefreshTokenModel from "../models/refresh-token.model.js";


import {
  generateRefreshToken,
  hashRefreshToken
} from "../utils/refresh-token.js";



import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";

import UserModel from "../models/user.model.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/jwt.js";;

export async function loginUser(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
      return;
    }

    // 2. Normalize the email
    const normalizedEmail = email.trim().toLowerCase();

    // 3. Find the user and include passwordHash
    const user = await UserModel.findOne({
      email: normalizedEmail
    }).select("+passwordHash");

    // 4. Reject an unknown email
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
      return;
    }

    // 5. Verify the submitted password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isPasswordCorrect) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
      return;
    }

    
 
// 6. Generate the session ID
const familyId = new Types.ObjectId();

// Generate the access token with user ID and session ID
const accessTokenOptions: SignOptions = {
  expiresIn: JWT_EXPIRES_IN
};

const token = jwt.sign(
  {
    userId: user._id.toString(),
    sid: familyId.toString()
  },
  JWT_SECRET,
  accessTokenOptions
);

// Generate the refresh token
const refreshToken = generateRefreshToken();
const tokenHash = hashRefreshToken(refreshToken);

const refreshExpiresAt = new Date(
  Date.now() + 7 * 24 * 60 * 60 * 1000
);

// Save the refresh token under the SAME session ID
await RefreshTokenModel.create({
  userId: user._id,
  familyId,
  tokenHash,
  usedAt: null,
  revokedAt: null,
  expiresAt: refreshExpiresAt
});

   res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
});
    // 7. Return public user details
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login failed:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
}


export async function registerUser(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required fields
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
      return;
    }

    // 2. Normalize the email and name
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();


    // Validate name length
if (normalizedName.length < 2 || normalizedName.length > 50) {
  res.status(400).json({
    success: false,
    message: "Name must be between 2 and 50 characters"
  });
  return;
}

// Basic email format validation
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  res.status(400).json({
    success: false,
    message: "Please provide a valid email address"
  });
  return;
}

 // Validate password length
if (
  password.trim().length === 0 ||
  password.length < 8 ||
  Buffer.byteLength(password, "utf8") > 72
) {
  res.status(400).json({
    success: false,
    message: "Password must contain non-whitespace characters, be at least 8 characters, and at most 72 bytes"
  });
  return;
}

    // 3. Check whether the email already exists
    const existingUser = await UserModel.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email is already registered"
      });
      return;
    }

    // 4. Hash the password
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Save the new user in MongoDB
    const user = await UserModel.create({
  name: normalizedName,
  email: normalizedEmail,
  passwordHash
});

    // 6. Return public user details
    res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error: unknown) {
  // MongoDB duplicate-key error
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    res.status(409).json({
      success: false,
      message: "Email is already registered"
    });
    return;
  }

  console.error("Registration failed:", error);

  res.status(500).json({
    success: false,
    message: "Registration failed"
  });
}

}


export async function getMe(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const user = await UserModel.findById(req.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
}






export const refreshAccessToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;

  if (
    typeof refreshToken !== "string" ||
    refreshToken.length === 0
  ) {
    res.status(401).json({
      success: false,
      message: "Refresh token is required"
    });
    return;
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const replacementRefreshToken = generateRefreshToken();
  const replacementTokenHash =
    hashRefreshToken(replacementRefreshToken);

  const dbSession = await mongoose.startSession();

  const result: {
  outcome: "success" | "replay" | "invalid";
  accessToken?: string;
} = {
  outcome: "invalid"
};
  try {
    await dbSession.withTransaction(async () => {
      // Reset state because MongoDB may retry a transaction.
      result.outcome= "invalid";
      delete result.accessToken;

      const now = new Date();

      // Find this token, including historical records.
      const tokenRecord = await RefreshTokenModel.findOne({
        tokenHash
      }).session(dbSession);

      if (!tokenRecord) {
        result.outcome = "invalid";
        return;
      }

      // A token that was already consumed is being reused.
      if (tokenRecord.usedAt !== null) {
        await RefreshTokenModel.updateMany(
          {
            familyId: tokenRecord.familyId,
            revokedAt: null
          },
          {
            $set: { revokedAt: now }
          },
          { session: dbSession }
        );

        result.outcome = "replay";
        return;
      }

      // Reject expired or revoked tokens.
      if (
        tokenRecord.revokedAt !== null ||
        tokenRecord.expiresAt.getTime() <= now.getTime()
      ) {
        result.outcome = "invalid";
        return;
      }

      // Atomically consume the current token.
      const consumedToken =
        await RefreshTokenModel.findOneAndUpdate(
          {
            _id: tokenRecord._id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { $gt: now }
          },
          {
            $set: { usedAt: now }
          },
          {
            new: true,
            session: dbSession
          }
        );

      if (!consumedToken) {
        result.outcome = "invalid";
        return;
      }

      // Create the replacement in the SAME family.
      await RefreshTokenModel.create(
        [
          {
            userId: consumedToken.userId,
            familyId: consumedToken.familyId,
            tokenHash: replacementTokenHash,
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(
              now.getTime() + 7 * 24 * 60 * 60 * 1000
            )
          }
        ],
        { session: dbSession }
      );

      // Keep this payload consistent with loginUser.
      const accessTokenOptions: SignOptions = {
        expiresIn: JWT_EXPIRES_IN
      };

    result.accessToken = jwt.sign(
  {
    userId: consumedToken.userId.toString(),
    sid: consumedToken.familyId.toString()
  },
  JWT_SECRET,
  accessTokenOptions
);
      result.outcome = "success";
    });

    // Respond only after the transaction has committed.
    if (result.outcome === "replay") {
      res.status(401).json({
        success: false,
        message: "Refresh token reuse detected; session revoked"
      });
      return;
    }

    if (result.outcome !== "success" || !result.accessToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token is invalid, expired, or revoked"
      });
      return;
    }

    res.cookie("refreshToken", replacementRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: "Access token refreshed",
      token: result.accessToken
    });
  } catch (error) {
    console.error("Refresh token operation failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to refresh access token"
    });
  } finally {
    await dbSession.endSession();
  }
};





export const logoutUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (typeof refreshToken === "string" && refreshToken.length > 0) {
      const tokenHash = hashRefreshToken(refreshToken);

      // Find the refresh token, even if it has already been used.
      const tokenRecord = await RefreshTokenModel.findOne({
        tokenHash
      });

      if (tokenRecord) {
        // Revoke every token belonging to this login session.
        await RefreshTokenModel.updateMany(
          {
            familyId: tokenRecord.familyId,
            revokedAt: null
          },
          {
            $set: { revokedAt: new Date() }
          }
        );
      }
    }

    // Clear the cookie using the same path and security settings.
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth"
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to log out"
    });
  }
};

