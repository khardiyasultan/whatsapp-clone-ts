
import mongoose from "mongoose";

export function createParticipantKey(
  firstUserId: string,
  secondUserId: string
): string {
  const firstId = new mongoose.Types.ObjectId(firstUserId).toHexString();
  const secondId = new mongoose.Types.ObjectId(secondUserId).toHexString();

  return [firstId, secondId].sort().join(":");
}
