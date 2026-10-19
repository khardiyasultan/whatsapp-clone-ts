
import type { Response } from "express";
import mongoose from "mongoose";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import ContactModel from "../models/contact.model.js";
import UserModel from "../models/user.model.js";

export async function addContact(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;
    const { contactUserId } = req.body as {
      contactUserId?: unknown;
    };

    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (
      typeof contactUserId !== "string" ||
      !mongoose.isValidObjectId(contactUserId)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid contactUserId is required"
      });
      return;
    }

    if (userId === contactUserId) {
      res.status(400).json({
        success: false,
        message: "You cannot add yourself as a contact"
      });
      return;
    }

    const contactUser = await UserModel.findById(contactUserId)
      .select("_id")
      .lean();

    if (!contactUser) {
      res.status(404).json({
        success: false,
        message: "User to add was not found"
      });
      return;
    }

    const existingContact = await ContactModel.findOne({
      userId,
      contactUserId
    }).lean();

    if (existingContact) {
      res.status(409).json({
        success: false,
        message: "This user is already in your contacts"
      });
      return;
    }

    await ContactModel.create({
      userId,
      contactUserId
    });

    res.status(201).json({
      success: true,
      message: "Contact added successfully"
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "This user is already in your contacts"
      });
      return;
    }

    console.error("Add contact failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to add contact"
    });
  }
}



export async function getContacts(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const contacts = await ContactModel.find({ userId })
      .populate({
        path: "contactUserId",
        select: "name profilePhoto about"
      })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: contacts.length,
      contacts: contacts.map((contact) => contact.contactUserId)
    });
  } catch (error) {
    console.error("Get contacts failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve contacts"
    });
  }
}



export async function removeContact(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.userId;
    const { contactUserId } = req.params;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    if (
      typeof contactUserId !== "string" ||
      !mongoose.isValidObjectId(contactUserId)
    ) {
      res.status(400).json({
        success: false,
        message: "A valid contactUserId is required"
      });
      return;
    }

    const deletedContact = await ContactModel.findOneAndDelete({
      userId,
      contactUserId
    });

    if (!deletedContact) {
      res.status(404).json({
        success: false,
        message: "Contact not found in your contact list"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Contact removed successfully"
    });
  } catch (error) {
    console.error("Remove contact failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to remove contact"
    });
  }
}
