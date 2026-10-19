
import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  sendMessage,
  getMessages
} from "../controllers/message.controller.js";

const messageRouter = Router();

messageRouter.post("/", authenticateToken, sendMessage);
messageRouter.get("/:conversationId", authenticateToken, getMessages);

export default messageRouter;
