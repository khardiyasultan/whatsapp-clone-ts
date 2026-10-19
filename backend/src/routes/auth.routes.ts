import { Router } from "express";
import { ensureDB } from "../middleware/ensure-db.middleware.js";
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

authRouter.post("/register", ensureDB, registerUser);
authRouter.post("/login", ensureDB, loginUser);
authRouter.get("/me", ensureDB, authenticateToken, getMe);
authRouter.post("/refresh", ensureDB, refreshAccessToken);
authRouter.post("/logout", ensureDB, logoutUser);


export default authRouter;