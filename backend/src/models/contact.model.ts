
import { Schema, model, Types } from "mongoose";

interface IContact {
  userId: Types.ObjectId;
  contactUserId: Types.ObjectId;
}

const contactSchema = new Schema<IContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    contactUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

contactSchema.index(
  { userId: 1, contactUserId: 1 },
  { unique: true }
);

const ContactModel = model<IContact>("Contact", contactSchema);

export default ContactModel;
