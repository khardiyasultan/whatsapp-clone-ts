import { Router } from "express";

import {
  loginUser,
  registerUser,
  getMe,
  refreshAccessToken,
  logoutUser
} from "../controllers/auth.controller.js";




import { authenticateToken } from "../middleware/auth.middleware.js";

const authRouter = Router();


authRouter.get("/test", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Auth routes are working"
  });
});

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.get("/me", authenticateToken, getMe);
authRouter.post("/refresh", refreshAccessToken);
authRouter.post("/logout", logoutUser);


export default authRouter;