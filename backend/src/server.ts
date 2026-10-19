
import MessageModel from "./models/message.model.js";
//import { Types } from "mongoose";

import mongoose from "mongoose";
import ConversationModel from "./models/conversation.model.js";

import { setSocketServer } from "./config/socket.js";
import {
  addOnlineUser,
  removeOnlineSocket,
  isUserOnline
} from "./utils/online-users.js";


import {
  authenticateSocket,
  type AuthenticatedSocket
} from "./middleware/socket-auth.middleware.js";
import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { PORT } from "./config/env.js";
import { connectDB } from "./config/db.js";


async function startServer(): Promise<void> {
  try {
    await connectDB();

    const httpServer = createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
      }
    });
   
    setSocketServer(io);
   io.use(authenticateSocket);

    io.on("connection", (rawSocket) => {
  const socket = rawSocket as AuthenticatedSocket;
  console.log(`Socket connected: ${socket.id}`);


  if (!socket.userId) {
  socket.disconnect(true);
  return;
}

const userId = socket.userId;

addOnlineUser(userId, socket.id);

console.log(`User ${userId} is online`);
console.log("Is user online?", isUserOnline(userId));

io.emit("presence:update", {
  userId,
  isOnline: true
});

   
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
      message: "A valid conversationId is required"
    });
    return;
  }

  const userId = socket.userId;

  if (!userId) {
    reply({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  try {
    const conversation = await ConversationModel.findOne({
      _id: data.conversationId,
      participants: new mongoose.Types.ObjectId(userId)
    })
      .select("_id")
      .lean();

    if (!conversation) {
      reply({
        success: false,
        message: "Conversation not found or access denied"
      });
      return;
    }

    const room = `conversation:${conversation._id.toString()}`;

    await socket.join(room);

    reply({
      success: true,
      message: "Joined conversation successfully",
      conversationId: conversation._id.toString()
    });
  } catch (error) {
    console.error("Conversation room join failed:", error);

    reply({
      success: false,
      message: "Unable to join conversation"
    });
  }
});



socket.on("message:send", async (data, acknowledge) => {
  const reply =
    typeof acknowledge === "function" ? acknowledge : () => {};

  // 1. Validate the payload
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
      message: "Valid conversationId, clientMessageId and text are required"
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
      message: "Invalid clientMessageId or message text"
    });
    return;
  }

  const userId = socket.userId;

  if (!userId) {
    reply({
      success: false,
      message: "Authentication required"
    });
    return;
  }

  try {
    // 2. Confirm the sender belongs to the conversation
    const conversation = await ConversationModel.findOne({
      _id: conversationId,
      participants: new mongoose.Types.ObjectId(userId)
    })
      .select("_id")
      .lean();

    if (!conversation) {
      reply({
        success: false,
        message: "Conversation not found or access denied"
      });
      return;
    }

    // 3. Check whether this sender already sent this message
    const existingMessage = await MessageModel.findOne({
      senderId: new mongoose.Types.ObjectId(userId),
      clientMessageId
    });

    if (existingMessage) {
      if (
        existingMessage.conversationId.toString() !== conversationId ||
        existingMessage.text !== text
      ) {
        reply({
          success: false,
          message: "clientMessageId was already used for another message"
        });
        return;
      }

      reply({
        success: true,
        message: "Message already sent",
        data: existingMessage,
        duplicate: true
      });
      return;
    }

    // 4. Save a new message
    const message = await MessageModel.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      senderId: new mongoose.Types.ObjectId(userId),
      clientMessageId,
      text,
      messageType: "text",
      status: "sent"
    });

    // 5. Update conversation activity
    await ConversationModel.updateOne(
      { _id: conversation._id },
      { $set: { updatedAt: new Date() } }
    );

    // 6. Acknowledge and broadcast the new message
    reply({
      success: true,
      message: "Message sent successfully",
      data: message,
      duplicate: false
    });

    io.to(`conversation:${conversation._id.toString()}`).emit(
      "message:new",
      message
    );
  } catch (error) {
    // A unique-index collision can happen when retries arrive together.
    const isDuplicateKeyError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000;

    if (isDuplicateKeyError) {
      try {
        const existingMessage = await MessageModel.findOne({
          senderId: new mongoose.Types.ObjectId(userId),
          clientMessageId
        });

        if (
          existingMessage &&
          existingMessage.conversationId.toString() === conversationId &&
          existingMessage.text === text
        ) {
          reply({
            success: true,
            message: "Message already sent",
            data: existingMessage,
            duplicate: true
          });
          return;
        }

        reply({
          success: false,
          message: "clientMessageId was already used for another message"
        });
        return;
      } catch (lookupError) {
        console.error("Duplicate message lookup failed:", lookupError);
      }
    }

    console.error("Socket message send failed:", error);

    reply({
      success: false,
      message: "Unable to send message"
    });
  }
});

socket.on("message:delivered", async (data, acknowledge) => {
  const reply =
    typeof acknowledge === "function" ? acknowledge : () => {};

  // We'll implement validation and delivery logic here.
  // 1. Validate the payload.
if (
  typeof data !== "object" ||
  data === null ||
  !("messageId" in data) ||
  typeof data.messageId !== "string" ||
  !mongoose.isValidObjectId(data.messageId)
) {
  reply({
    success: false,
    message: "A valid messageId is required"
  });
  return;
}

const messageId = data.messageId;
const userId = socket.userId;

if (!userId) {
  reply({
    success: false,
    message: "Authentication required"
  });
  return;
}

try {
  // 2. Find the message in MongoDB.
  const message = await MessageModel.findById(messageId);

  if (!message) {
    reply({
      success: false,
      message: "Message not found"
    });
    return;
  }

  // 3. The sender cannot acknowledge their own message as delivered.
  if (message.senderId.toString() === userId) {
    reply({
      success: false,
      message: "Sender cannot acknowledge their own message"
    });
    return;
  }

  // 4. Verify that the recipient belongs to this conversation.
  const conversation = await ConversationModel.findOne({
    _id: message.conversationId,
    participants: new mongoose.Types.ObjectId(userId)
  })
    .select("_id")
    .lean();

  if (!conversation) {
    reply({
      success: false,
      message: "Conversation not found or access denied"
    });
    return;
  }

  // 5. Update status without downgrading a read message.
const updatedMessage = await MessageModel.findOneAndUpdate(
  {
    _id: message._id,
    status: "sent"
  },
  {
    $set: { status: "delivered" }
  },
  {
  returnDocument: "after"
}
);

const finalMessage =
  updatedMessage ??
  await MessageModel.findById(message._id) ??
  message;

// Notify the sender about the updated delivery status.
io.to(`conversation:${message.conversationId.toString()}`).emit(
  "message:status",
  {
    messageId: finalMessage._id.toString(),
    status: finalMessage.status
  }
);

reply({
  success: true,
  message: "Message delivery acknowledged",
  data: {
    messageId: finalMessage._id.toString(),
    status: finalMessage.status
  }
});
} catch (error) {
  console.error("Message delivery acknowledgment failed:", error);

  reply({
    success: false,
    message: "Unable to acknowledge message delivery"
  });
}

});

socket.on("message:read", async (data, acknowledge) => {
  const reply =
    typeof acknowledge === "function" ? acknowledge : () => {};

  // Add validation here, below the reply declaration.
  if (
    typeof data !== "object" ||
    data === null ||
    !("messageId" in data) ||
    typeof data.messageId !== "string" ||
    !mongoose.isValidObjectId(data.messageId)
  ) {
    reply({
      success: false,
      message: "Invalid messageId"
    });
    return;
  }

  const messageId = data.messageId;
const userId = socket.userId;

if (!userId) {
  reply({
    success: false,
    message: "Unauthorized"
  });
  return;
}
try {
  const message = await MessageModel.findById(messageId);

  if (!message) {
    reply({
      success: false,
      message: "Message not found"
    });
    return;
  }

  // ADD THE NEW CHECK HERE
  if (message.senderId.toString() === userId) {
    reply({
      success: false,
      message: "Sender cannot mark their own message as read"
    });
    return;
  }

  const conversation = await ConversationModel.findOne({
  _id: message.conversationId,
  participants: new mongoose.Types.ObjectId(userId)
})
  .select("_id")
  .lean();

if (!conversation) {
  reply({
    success: false,
    message: "Conversation not found or access denied"
  });
  return;
}

const updatedMessage = await MessageModel.findOneAndUpdate(
  {
    _id: message._id,
    status: { $ne: "read" }
  },
  {
    $set: { status: "read" }
  },
  {
    returnDocument: "after"
  }
);

const finalMessage =
  updatedMessage ??
  await MessageModel.findById(message._id) ??
  message;

io.to(`conversation:${message.conversationId.toString()}`).emit(
  "message:status",
  {
    messageId: finalMessage._id.toString(),
    status: finalMessage.status
  }
);

reply({
  success: true,
  message: "Message marked as read",
  data: {
    messageId: finalMessage._id.toString(),
    status: finalMessage.status
  }
});

} catch (error) {
  console.error("Read receipt lookup failed:", error);

  reply({
    success: false,
    message: "Unable to process read receipt"
  });
  return;
}

  // Next, we'll add the authorization logic here.
});


  socket.on("ping:app", (data) => {
    console.log("Received from Postman:", data);

    socket.emit("pong:app", {
      success: true,
      received: data
    });
  });
     
  socket.on("ack:demo", (data, acknowledge) => {
  console.log("Received ack:demo:", data);

  if (typeof acknowledge !== "function") {
    console.log("No acknowledgement callback provided");
    return;
  }

  if (
    typeof data !== "object" ||
    data === null ||
    typeof data.text !== "string" ||
    data.text.trim().length === 0 ||
    typeof data.user !== "string" ||
    data.user.trim().length === 0
  ) {
    acknowledge({
      success: false,
      message: "Invalid payload: text and user are required"
    });
    return;
  }

  acknowledge({
    success: true,
    message: "Payload validated successfully",
    received: {
      text: data.text.trim(),
      user: data.user.trim()
    }
  });
});

socket.on("ack:timeout-test", (data) => {
  console.log("Received timeout test:", data);

  // Intentionally do not send an acknowledgement.
});

  socket.on("disconnect", () => {
  const userId = socket.userId;

  if (userId) {
    removeOnlineSocket(userId, socket.id);

    const isOnline = isUserOnline(userId);

    console.log(`User ${userId} online: ${isOnline}`);

    if (!isOnline) {
      io.emit("presence:update", {
        userId,
        isOnline: false
      });
    }
  }

  console.log(`Socket disconnected: ${socket.id}`);
});


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
