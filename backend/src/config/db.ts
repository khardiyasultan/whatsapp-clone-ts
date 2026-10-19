
import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from the environment");
  }

  // Reuse an existing connection.
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Reuse an ongoing connection attempt.
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri).catch((error: unknown) => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
}
