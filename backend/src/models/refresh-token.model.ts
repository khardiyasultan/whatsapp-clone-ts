
import { Schema, model, Types } from "mongoose";

interface IRefreshToken {
  userId: Types.ObjectId;
  familyId: Types.ObjectId;
  tokenHash: string;
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    familyId: {
      type: Schema.Types.ObjectId,
      required: true
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false
    },

    usedAt: {
      type: Date,
      default: null
    },

    revokedAt: {
      type: Date,
      default: null
    },

    expiresAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

refreshTokenSchema.index({ familyId: 1 });
refreshTokenSchema.index({ userId: 1, familyId: 1 });

const RefreshTokenModel = model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);

export default RefreshTokenModel;
