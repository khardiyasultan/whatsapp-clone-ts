
import { Router } from "express";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  addContact,
  getContacts,
  removeContact
} from "../controllers/contact.controller.js";

const contactRouter = Router();

contactRouter.post("/", authenticateToken, addContact);
contactRouter.get("/", authenticateToken, getContacts);
contactRouter.delete("/:contactUserId", authenticateToken, removeContact);

export default contactRouter;
