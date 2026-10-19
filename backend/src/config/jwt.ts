import "dotenv/config";
import type { SignOptions } from "jsonwebtoken";
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is missing from the environment");
}

if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error(
    "JWT_SECRET must be at least 32 bytes long"
  );
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "15m";

const validExpiry = /^\d+(s|m|h|d)$/;

if (!validExpiry.test(jwtExpiresIn)) {
  throw new Error(
    "JWT_EXPIRES_IN must be a duration such as 30s, 15m, 1h, or 7d"
  );
}

export const JWT_SECRET = jwtSecret;
export const JWT_EXPIRES_IN =
  jwtExpiresIn as NonNullable<SignOptions["expiresIn"]>;