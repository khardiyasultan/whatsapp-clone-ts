
import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  createConversation,
  getConversations
} from "../controllers/conversation.controller.js";

const conversationRouter = Router();

conversationRouter.post("/", authenticateToken, createConversation);
conversationRouter.get("/", authenticateToken, getConversations);

export default conversationRouter;
