
import { Schema, model } from "mongoose";

interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  profilePhoto: string | null;
  about: string;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false
  },
  profilePhoto: {
    type: String,
    default: null
  },
  about: {
    type: String,
    default: "Hey there! I am using WhatsApp."
  }
});

const UserModel = model<IUser>("User", userSchema);

export default UserModel;
