import express from "express";

import {
	getConversations,
	getConversation,
	getMessages,
	createConversation,
	sendMessage,
	markMessageAsRead,
	markConversationAsRead,
	getUnreadCount,
	deleteMessage,
	editMessage,
	getUserIdsByRole,
} from "../controllers/message.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/users/:role", getUserIdsByRole);

router.use(authenticate);

// Conversation routes (no file upload needed)
router.get("/conversations", getConversations);
router.get("/conversations/:conversationId", getConversation);
router.post("/conversations", createConversation);
router.patch("/conversations/:conversationId/read", markConversationAsRead);

// Message routes
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/send", sendMessage); // Text messages only
router.patch("/messages/:messageId/read", markMessageAsRead);
router.patch("/messages/:messageId", editMessage);
router.delete("/messages/:messageId", deleteMessage);

// Utility routes
router.get("/unread-count", getUnreadCount);

export default router;
