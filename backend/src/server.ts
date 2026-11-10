import MessageModel from "./models/message.model.js";
import mongoose from "mongoose";
import ConversationModel from "./models/conversation.model.js";

import { setSocketServer } from "./config/socket.js";
import {
  addOnlineUser,
  removeOnlineSocket,
  isUserOnline,
} from "./utils/online-users.js";

import {
  authenticateSocket,
  type AuthenticatedSocket,
} from "./middleware/socket-auth.middleware.js";

import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { PORT } from "./config/env.js";
import { connectDB } from "./config/db.js";

type MessageStatus = "sent" | "delivered" | "read";

function isValidMessagePayload(data: unknown): data is {
  messageId: string;
} {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  if (!("messageId" in data)) {
    return false;
  }

  return (
    typeof data.messageId === "string" &&
    mongoose.isValidObjectId(data.messageId)
  );
}

function emitMessageStatus(
  io: Server,
  senderId: string,
  messageId: string,
  status: MessageStatus,
): void {
  // All connected devices of the original sender receive the update.
  io.to(`user:${senderId}`).emit("message:status", {
    messageId,
    status,
  });
}

async function startServer(): Promise<void> {
  try {
    await connectDB();

    const httpServer = createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    setSocketServer(io);

    // Authenticate every socket before allowing a connection.
    io.use(authenticateSocket);

    io.on("connection", async (rawSocket) => {
      const socket = rawSocket as AuthenticatedSocket;

      console.log(`Socket connected: ${socket.id}`);

      const userId = socket.userId;

      if (!userId) {
        socket.disconnect(true);
        return;
      }

      try {
        // One user can have multiple connected devices.
        addOnlineUser(userId, socket.id);

        // Every authenticated device joins its personal room.
        // This room receives messages and status updates for this user.
        await socket.join(`user:${userId}`);

        const activeTypingConversations = new Set<string>();

        const handleTyping = async (
          data: unknown,
          event: "typing:start" | "typing:stop",
        ) => {
          try {
            if (
              !data ||
              typeof data !== "object" ||
              !("conversationId" in data) ||
              typeof data.conversationId !== "string" ||
              !mongoose.isValidObjectId(data.conversationId)
            ) {
              return;
            }

            const conversationId = data.conversationId;

            // Verify that the sender belongs to this conversation.
            const conversation = await ConversationModel.findOne({
              _id: new mongoose.Types.ObjectId(conversationId),
              participants: new mongoose.Types.ObjectId(userId),
            }).select("_id participants");

            if (!conversation) return;

            if (event === "typing:start") {
              activeTypingConversations.add(conversationId);
            } else {
              activeTypingConversations.delete(conversationId);
            }

            // Notify other participants.
            for (const participantId of conversation.participants) {
              const recipientId = participantId.toString();

              if (recipientId === userId) continue;

              io.to(`user:${recipientId}`).emit(event, {
                conversationId,
                userId,
              });
            }
          } catch (error) {
            console.error(`${event} error:`, error);
          }
        };

        socket.on("typing:start", (data: unknown) => {
          void handleTyping(data, "typing:start");
        });

        socket.on("typing:stop", (data: unknown) => {
          void handleTyping(data, "typing:stop");
        });

        console.log(`User ${userId} is online`);

        io.emit("presence:update", {
          userId,
          isOnline: true,
        });

        // --------------------------------------------------
        // CONVERSATION JOIN
        // --------------------------------------------------

        socket.on("conversation:join", async (data, acknowledge) => {
          const reply =
            typeof acknowledge === "function" ? acknowledge : () => {};

          if (
            typeof data !== "object" ||
            data === null ||
            !("conversationId" in data) ||
            typeof data.conversationId !== "string" ||
            !mongoose.isValidObjectId(data.conversationId)
          ) {
            reply({
              success: false,
              message: "A valid conversationId is required",
            });
            return;
          }

          try {
            const conversation = await ConversationModel.findOne({
              _id: data.conversationId,
              participants: new mongoose.Types.ObjectId(userId),
            })
              .select("_id")
              .lean();

            if (!conversation) {
              reply({
                success: false,
                message: "Conversation not found or access denied",
              });
              return;
            }

            const room = `conversation:${conversation._id.toString()}`;

            await socket.join(room);

            reply({
              success: true,
              message: "Joined conversation successfully",
              conversationId: conversation._id.toString(),
            });
          } catch (error) {
            console.error("Conversation join failed:", error);

            reply({
              success: false,
              message: "Unable to join conversation",
            });
          }
        });

        // --------------------------------------------------
        // CONVERSATION LEAVE
        // --------------------------------------------------

        socket.on("conversation:leave", async (data) => {
          if (
            typeof data !== "object" ||
            data === null ||
            !("conversationId" in data) ||
            typeof data.conversationId !== "string" ||
            !mongoose.isValidObjectId(data.conversationId)
          ) {
            return;
          }

          try {
            // Only leave the room if this user is a participant.
            const conversation = await ConversationModel.findOne({
              _id: data.conversationId,
              participants: new mongoose.Types.ObjectId(userId),
            })
              .select("_id")
              .lean();

            if (!conversation) return;

            await socket.leave(`conversation:${conversation._id.toString()}`);
          } catch (error) {
            console.error("Conversation leave failed:", error);
          }
        });

        // --------------------------------------------------
        // SOCKET MESSAGE SEND
        // --------------------------------------------------

        socket.on("message:send", async (data, acknowledge) => {
          const reply =
            typeof acknowledge === "function" ? acknowledge : () => {};

          if (
            typeof data !== "object" ||
            data === null ||
            !("conversationId" in data) ||
            typeof data.conversationId !== "string" ||
            !mongoose.isValidObjectId(data.conversationId) ||
            !("clientMessageId" in data) ||
            typeof data.clientMessageId !== "string" ||
            !("text" in data) ||
            typeof data.text !== "string"
          ) {
            reply({
              success: false,
              message:
                "Valid conversationId, clientMessageId and text are required",
            });
            return;
          }

          const conversationId = data.conversationId;
          const clientMessageId = data.clientMessageId.trim();
          const text = data.text.trim();

          if (
            clientMessageId.length === 0 ||
            clientMessageId.length > 100 ||
            text.length === 0 ||
            text.length > 5000
          ) {
            reply({
              success: false,
              message: "Invalid clientMessageId or message text",
            });
            return;
          }

          try {
            // Verify that the sender belongs to this conversation.
            const conversation = await ConversationModel.findOne({
              _id: conversationId,
              participants: new mongoose.Types.ObjectId(userId),
            })
              .select("_id participants")
              .lean();

            if (!conversation) {
              reply({
                success: false,
                message: "Conversation not found or access denied",
              });
              return;
            }

            // Idempotency: the same client message must not be saved twice.
            const existingMessage = await MessageModel.findOne({
              senderId: new mongoose.Types.ObjectId(userId),
              clientMessageId,
            });

            if (existingMessage) {
              if (
                existingMessage.conversationId.toString() !== conversationId ||
                existingMessage.text !== text
              ) {
                reply({
                  success: false,
                  message:
                    "clientMessageId was already used for another message",
                });
                return;
              }

              // Re-broadcast an existing message to recover from a missed event.
              for (const participantId of conversation.participants) {
                io.to(`user:${participantId.toString()}`).emit(
                  "message:new",
                  existingMessage,
                );
              }

              reply({
                success: true,
                message: "Message already sent",
                data: existingMessage,
                duplicate: true,
              });

              return;
            }

            const message = await MessageModel.create({
              conversationId: new mongoose.Types.ObjectId(conversationId),
              senderId: new mongoose.Types.ObjectId(userId),
              clientMessageId,
              text,
              messageType: "text",
              status: "sent",
            });

            await ConversationModel.updateOne(
              { _id: conversation._id },
              { $set: { updatedAt: new Date() } },
            );

            // Deliver to every participant's personal room.
            // This works even when the recipient is viewing another chat.
            for (const participantId of conversation.participants) {
              io.to(`user:${participantId.toString()}`).emit(
                "message:new",
                message,
              );
            }

            reply({
              success: true,
              message: "Message sent successfully",
              data: message,
              duplicate: false,
            });
          } catch (error) {
            const isDuplicateKeyError =
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === 11000;

            if (isDuplicateKeyError) {
              try {
                const existingMessage = await MessageModel.findOne({
                  senderId: new mongoose.Types.ObjectId(userId),
                  clientMessageId,
                });

                if (
                  existingMessage &&
                  existingMessage.conversationId.toString() ===
                    conversationId &&
                  existingMessage.text === text
                ) {
                  reply({
                    success: true,
                    message: "Message already sent",
                    data: existingMessage,
                    duplicate: true,
                  });
                  return;
                }
              } catch (lookupError) {
                console.error("Duplicate message lookup failed:", lookupError);
              }
            }

            console.error("Socket message send failed:", error);

            reply({
              success: false,
              message: "Unable to send message",
            });
          }
        });

        // --------------------------------------------------
        // MESSAGE DELIVERED RECEIPT
        // --------------------------------------------------

        socket.on("message:delivered", async (data, acknowledge) => {
          const reply =
            typeof acknowledge === "function" ? acknowledge : () => {};

          if (!isValidMessagePayload(data)) {
            reply({
              success: false,
              message: "A valid messageId is required",
            });
            return;
          }

          try {
            const message = await MessageModel.findById(data.messageId);

            if (!message) {
              reply({
                success: false,
                message: "Message not found",
              });
              return;
            }

            // A sender cannot acknowledge their own message.
            if (message.senderId.toString() === userId) {
              reply({
                success: false,
                message: "Sender cannot acknowledge their own message",
              });
              return;
            }

            // Confirm the current user is a participant.
            const conversation = await ConversationModel.findOne({
              _id: message.conversationId,
              participants: new mongoose.Types.ObjectId(userId),
            })
              .select("_id")
              .lean();

            if (!conversation) {
              reply({
                success: false,
                message: "Conversation not found or access denied",
              });
              return;
            }

            // Only transition sent -> delivered.
            // Never downgrade a message that is already read.
            const updatedMessage = await MessageModel.findOneAndUpdate(
              {
                _id: message._id,
                status: "sent",
              },
              {
                $set: { status: "delivered" },
              },
              {
                returnDocument: "after",
              },
            );

            const finalMessage =
              updatedMessage ??
              (await MessageModel.findById(message._id)) ??
              message;

            emitMessageStatus(
              io,
              message.senderId.toString(),
              finalMessage._id.toString(),
              finalMessage.status,
            );

            reply({
              success: true,
              message: "Message delivery acknowledged",
              data: {
                messageId: finalMessage._id.toString(),
                status: finalMessage.status,
              },
            });
          } catch (error) {
            console.error("Delivery receipt failed:", error);

            reply({
              success: false,
              message: "Unable to acknowledge message delivery",
            });
          }
        });

        // --------------------------------------------------
        // MESSAGE READ RECEIPT
        // --------------------------------------------------

        socket.on("message:read", async (data, acknowledge) => {
          const reply =
            typeof acknowledge === "function" ? acknowledge : () => {};

          if (!isValidMessagePayload(data)) {
            reply({
              success: false,
              message: "A valid messageId is required",
            });
            return;
          }

          try {
            const message = await MessageModel.findById(data.messageId);

            if (!message) {
              reply({
                success: false,
                message: "Message not found",
              });
              return;
            }

            // A sender cannot mark their own message as read.
            if (message.senderId.toString() === userId) {
              reply({
                success: false,
                message: "Sender cannot mark their own message as read",
              });
              return;
            }

            // Verify recipient membership.
            const conversation = await ConversationModel.findOne({
              _id: message.conversationId,
              participants: new mongoose.Types.ObjectId(userId),
            })
              .select("_id")
              .lean();

            if (!conversation) {
              reply({
                success: false,
                message: "Conversation not found or access denied",
              });
              return;
            }

            // Read is the final state; never downgrade it.
            const updatedMessage = await MessageModel.findOneAndUpdate(
              {
                _id: message._id,
                status: { $ne: "read" },
              },
              {
                $set: { status: "read" },
              },
              {
                returnDocument: "after",
              },
            );

            const finalMessage =
              updatedMessage ??
              (await MessageModel.findById(message._id)) ??
              message;

            emitMessageStatus(
              io,
              message.senderId.toString(),
              finalMessage._id.toString(),
              finalMessage.status,
            );

            reply({
              success: true,
              message: "Message marked as read",
              data: {
                messageId: finalMessage._id.toString(),
                status: finalMessage.status,
              },
            });
          } catch (error) {
            console.error("Read receipt failed:", error);

            reply({
              success: false,
              message: "Unable to process read receipt",
            });
          }
        });

        // --------------------------------------------------
        // INITIAL ONLINE PRESENCE
        // --------------------------------------------------

        socket.on("presence:request", async (acknowledge) => {
          const reply =
            typeof acknowledge === "function" ? acknowledge : () => {};

          try {
            const conversations = await ConversationModel.find({
              participants: new mongoose.Types.ObjectId(userId),
            })
              .select("participants")
              .lean();

            const contactIds = new Set<string>();

            for (const conversation of conversations) {
              for (const participantId of conversation.participants) {
                const contactId = participantId.toString();

                if (contactId !== userId) {
                  contactIds.add(contactId);
                }
              }
            }

            const onlineUserIds = [...contactIds].filter((id) =>
              isUserOnline(id),
            );

            reply({
              success: true,
              onlineUserIds,
            });
          } catch (error) {
            console.error("Initial presence lookup failed:", error);

            reply({
              success: false,
              onlineUserIds: [],
            });
          }
        });

        // --------------------------------------------------
        // TEST EVENTS
        // --------------------------------------------------

        socket.on("ping:app", (data) => {
          socket.emit("pong:app", {
            success: true,
            received: data,
          });
        });

        socket.on("ack:demo", (data, acknowledge) => {
          if (typeof acknowledge !== "function") {
            return;
          }

          if (
            typeof data !== "object" ||
            data === null ||
            !("text" in data) ||
            typeof data.text !== "string" ||
            data.text.trim().length === 0 ||
            !("user" in data) ||
            typeof data.user !== "string" ||
            data.user.trim().length === 0
          ) {
            acknowledge({
              success: false,
              message: "Invalid payload: text and user are required",
            });
            return;
          }

          acknowledge({
            success: true,
            message: "Payload validated successfully",
            received: {
              text: data.text.trim(),
              user: data.user.trim(),
            },
          });
        });

        socket.on("ack:timeout-test", (data) => {
          console.log("Received timeout test:", data);
          // Intentionally no acknowledgement.
        });

        // --------------------------------------------------
        // DISCONNECT / ONLINE PRESENCE
        // --------------------------------------------------

        socket.on("disconnect", () => {
          for (const conversationId of activeTypingConversations) {
            void handleTyping({ conversationId }, "typing:stop");
          }
          removeOnlineSocket(userId, socket.id);

          const isOnline = isUserOnline(userId);

          console.log(`User ${userId} online: ${isOnline}`);
          console.log(`Socket disconnected: ${socket.id}`);

          // A user is offline only when their last device disconnects.
          if (!isOnline) {
            io.emit("presence:update", {
              userId,
              isOnline: false,
            });
          }
        });
      } catch (error) {
        console.error("Socket connection setup failed:", error);
        socket.disconnect(true);
      }
    });

    httpServer.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
