
import { Schema, model, Types } from "mongoose";

interface IMessage {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientMessageId: string;
  text: string;
  messageType: "text";
  status: "sent" | "delivered" | "read";
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    clientMessageId: {
  type: String,
  required: true,
  trim: true
},
    text: {
      type: String,
      required: true,
      trim: true
    },
    messageType: {
      type: String,
      enum: ["text"],
      default: "text",
      required: true
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
      required: true
    }
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, _id: -1 });

messageSchema.index(
  { senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientMessageId: { $type: "string" }
    }
  }
);

const MessageModel = model<IMessage>("Message", messageSchema);

export default MessageModel;
