
import { ensureDB } from "./middleware/ensure-db.middleware.js";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";

import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import contactRouter from "./routes/contact.routes.js";
import conversationRouter from "./routes/conversation.routes.js";
import messageRouter from "./routes/message.routes.js";


const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use("/api/users", ensureDB, userRouter);
app.use("/api/contacts", ensureDB, contactRouter);
app.use("/api/conversations", ensureDB, conversationRouter);
app.use("/api/messages", ensureDB, messageRouter);


// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "WhatsApp Clone API is running"
  });
});

// Routes
app.use("/api/auth", authRouter);

export default app;
