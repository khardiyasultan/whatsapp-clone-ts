
import type { Response } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import ConversationModel from "../models/conversation.model.js";
import MessageModel from "../models/message.model.js";
import { getSocketServer } from "../config/socket.js";

// export async function sendMessage(
//   req: AuthRequest,
//   res: Response
// ): Promise<void> {
//   try {
//     const senderId = req.userId;
//     const { conversationId, text } = req.body as {
//       conversationId?: unknown;
//       text?: unknown;
//     };

//     if (!senderId || !mongoose.isValidObjectId(senderId)) {
//       res.status(401).json({
//         success: false,
//         message: "Authentication required"
//       });
//       return;
//     }

//     if (
//       typeof conversationId !== "string" ||
//       !mongoose.isValidObjectId(conversationId)
//     ) {
//       res.status(400).json({
//         success: false,
//         message: "A valid conversationId is required"
//       });
//       return;
//     }

//     if (typeof text !== "string" || !text.trim()) {
//       res.status(400).json({
//         success: false,
//         message: "Message text cannot be empty"
//       });
//       return;
//     }

//     const conversation = await ConversationModel.findOne({
//       _id: conversationId,
//       participants: new mongoose.Types.ObjectId(senderId)
//     }).lean();

//     if (!conversation) {
//       res.status(404).json({
//         success: false,
//         message: "Conversation not found or access denied"
//       });
//       return;
//     }

//     const message = await MessageModel.create({
//       conversationId: new mongoose.Types.ObjectId(conversationId),
//       senderId: new mongoose.Types.ObjectId(senderId),
//       text: text.trim(),
//       messageType: "text",
//       status: "sent"
//     });

//     await ConversationModel.updateOne(
//       { _id: conversationId },
//       { $set: { updatedAt: new Date() } }
//     );

//     res.status(201).json({
//       success: true,
//       message: "Message sent successfully",
//       data: message
//     });
//   } catch (error) {
//     console.error("Send message failed:", error);

//     res.status(500).json({
//       success: false,
//       message: "Unable to send message"
//     });
//   }
// }


export async function sendMessage(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const senderId = req.userId;

    const { conversationId, clientMessageId, text } = req.body as {
      conversationId?: unknown;
      clientMessageId?: unknown;
      text?: unknown;
    };

    if (!senderId || !mongoose.isValidObjectId(senderId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (
      typeof conversationId !== "string" ||
      !mongoose.isValidObjectId(conversationId)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid conversationId is required"
      });
      return;
    }

    if (
      typeof clientMessageId !== "string" ||
      clientMessageId.trim().length === 0 ||
      clientMessageId.trim().length > 100
    ) {
      res.status(400).json({
        success: false,
        message: "clientMessageId must contain 1 to 100 characters"
      });
      return;
    }

    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({
        success: false,
        message: "Message text cannot be empty"
      });
      return;
    }

    const normalizedClientMessageId = clientMessageId.trim();
    const normalizedText = text.trim();
    const conversationObjectId =
      new mongoose.Types.ObjectId(conversationId);
    const senderObjectId = new mongoose.Types.ObjectId(senderId);

    // 1. Verify that the sender belongs to this conversation.
    const conversation = await ConversationModel.findOne({
      _id: conversationObjectId,
      participants: senderObjectId
    }).lean();

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: "Conversation not found or access denied"
      });
      return;
    }

    // 2. Check whether this sender already used this ID.
    const existingMessage = await MessageModel.findOne({
      senderId: senderObjectId,
      clientMessageId: normalizedClientMessageId
    }).lean();

    if (existingMessage) {
      // Never let a retry ID silently refer to different content.
      if (
        existingMessage.conversationId.toString() !==
          conversationObjectId.toString() ||
        existingMessage.text !== normalizedText
      ) {
        res.status(409).json({
          success: false,
          message: "clientMessageId was already used for another message"
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Message already sent",
        data: existingMessage,
        duplicate: true
      });
      return;
    }

    // 3. Create a new message.
    let message;

    try {
      message = await MessageModel.create({
        conversationId: conversationObjectId,
        senderId: senderObjectId,
        clientMessageId: normalizedClientMessageId,
        text: normalizedText,
        messageType: "text",
        status: "sent"
      });
    } catch (error: unknown) {
      // Two identical requests can arrive at nearly the same time.
      // The unique database index is the final protection against duplicates.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        const duplicateMessage = await MessageModel.findOne({
          senderId: senderObjectId,
          clientMessageId: normalizedClientMessageId
        }).lean();

        if (
          duplicateMessage &&
          duplicateMessage.conversationId.toString() ===
            conversationObjectId.toString() &&
          duplicateMessage.text === normalizedText
        ) {
          res.status(200).json({
            success: true,
            message: "Message already sent",
            data: duplicateMessage,
            duplicate: true
          });
          return;
        }

        res.status(409).json({
          success: false,
          message: "clientMessageId was already used for another message"
        });
        return;
      }

      throw error;
    }

    // 4. Update conversation activity for the conversation list.
    await ConversationModel.updateOne(
      { _id: conversationObjectId },
      { $set: { updatedAt: new Date() } }
    );

     // 5. Broadcast the new message to everyone in the conversation room.
const io = getSocketServer();

io.to(`conversation:${conversationObjectId.toString()}`).emit(
  "message:new",
  message
);


    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
      duplicate: false
    });
  } catch (error) {
    console.error("Send message failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to send message"
    });
  }
}





export async function getMessages(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;
    const { conversationId } = req.params;
    const { limit: rawLimit, cursor } = req.query;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (
      typeof conversationId !== "string" ||
      !mongoose.isValidObjectId(conversationId)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid conversationId is required"
      });
      return;
    }

    let limit = 20;

    if (rawLimit !== undefined) {
      if (
        typeof rawLimit !== "string" ||
        !/^\d+$/.test(rawLimit)
      ) {
        res.status(400).json({
          success: false,
          message: "limit must be a positive integer"
        });
        return;
      }

      limit = Number(rawLimit);

      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: "limit must be between 1 and 100"
        });
        return;
      }
    }

    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      participants: new mongoose.Types.ObjectId(userId)
    }).lean();

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: "Conversation not found or access denied"
      });
      return;
    }

    const messageFilter: {
      conversationId: mongoose.Types.ObjectId;
      _id?: { $lt: mongoose.Types.ObjectId };
    } = {
      conversationId: new mongoose.Types.ObjectId(conversationId)
    };

    if (cursor !== undefined) {
      if (
        typeof cursor !== "string" ||
        !mongoose.isValidObjectId(cursor)
      ) {
        res.status(400).json({
          success: false,
          message: "A valid cursor is required"
        });
        return;
      }

      messageFilter._id = {
        $lt: new mongoose.Types.ObjectId(cursor)
      };
    }

    const fetchedMessages = await MessageModel.find(messageFilter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = fetchedMessages.length > limit;
    const page = fetchedMessages.slice(0, limit);
    const messages = page.reverse();

    const nextCursor = hasMore
      ? messages[0]?._id.toString()
      : null;

    res.status(200).json({
      success: true,
      count: messages.length,
      hasMore,
      nextCursor,
      messages
    });
  } catch (error) {
    console.error("Get messages failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve messages"
    });
  }
}
