
import { Schema, model, Types } from "mongoose";

interface IConversation {
  participants: [Types.ObjectId, Types.ObjectId];
  participantKey: string;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true
        }
      ],
      required: true,
      validate: {
        validator: (participants: Types.ObjectId[]) =>
          participants.length === 2 &&
          !participants[0]?.equals(participants[1]),
        message:
          "A conversation must have exactly two different participants"
      }
    },
    participantKey: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

conversationSchema.index(
  { participantKey: 1 },
  { unique: true }
);

const ConversationModel = model<IConversation>(
  "Conversation",
  conversationSchema
);

export default ConversationModel;
