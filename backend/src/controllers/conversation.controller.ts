
import type { Response } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import UserModel from "../models/user.model.js";
import ConversationModel from "../models/conversation.model.js";
import { createParticipantKey } from "../utils/conversation-key.js";

export async function createConversation(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const currentUserId = req.userId;
    const { recipientId } = req.body as { recipientId?: unknown };

    if (
      !currentUserId ||
      !mongoose.isValidObjectId(currentUserId)
    ) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (
      typeof recipientId !== "string" ||
      !mongoose.isValidObjectId(recipientId)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid recipientId is required"
      });
      return;
    }

    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

    if (currentObjectId.equals(recipientObjectId)) {
      res.status(400).json({
        success: false,
        message: "You cannot start a conversation with yourself"
      });
      return;
    }

    const recipient = await UserModel.findById(recipientObjectId)
      .select("_id")
      .lean();

    if (!recipient) {
      res.status(404).json({
        success: false,
        message: "Recipient user was not found"
      });
      return;
    }

    const participantKey = createParticipantKey(
      currentUserId,
      recipientId
    );

    const existingConversation = await ConversationModel.findOne({
      participantKey
    }).lean();

    if (existingConversation) {
      res.status(200).json({
        success: true,
        message: "Conversation already exists",
        conversation: existingConversation
      });
      return;
    }

    try {
      const conversation = await ConversationModel.create({
        participants: [currentObjectId, recipientObjectId].sort(
          (a, b) => a.toHexString().localeCompare(b.toHexString())
        ),
        participantKey
      });

      res.status(201).json({
        success: true,
        message: "Conversation created successfully",
        conversation
      });
    } catch (error) {
      // Another request may have created this conversation concurrently.
      if (
        error instanceof mongoose.mongo.MongoServerError &&
        error.code === 11000
      ) {
        const conversation = await ConversationModel.findOne({
          participantKey
        }).lean();

        if (conversation) {
          res.status(200).json({
            success: true,
            message: "Conversation already exists",
            conversation
          });
          return;
        }
      }

      throw error;
    }
  } catch (error) {
    console.error("Create conversation failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create conversation"
    });
  }
}



export async function getConversations(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const conversations = await ConversationModel.find({
      participants: new mongoose.Types.ObjectId(userId)
    })
      .populate({
        path: "participants",
        select: "name profilePhoto about"
      })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    console.error("Get conversations failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve conversations"
    });
  }
}
