
import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  searchUsers,
  updateProfile
} from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.get("/search", authenticateToken, searchUsers);
userRouter.patch("/profile", authenticateToken, updateProfile);

export default userRouter;
