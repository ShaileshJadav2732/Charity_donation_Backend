import express from "express";
import {
	getUserNotifications,
	markNotificationsAsRead,
	deleteNotifications,
} from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get user's notifications
router.get("/", getUserNotifications);

// Mark notifications as read
router.patch("/read", markNotificationsAsRead);

// Delete notifications
router.delete("/", deleteNotifications);

export default router;
