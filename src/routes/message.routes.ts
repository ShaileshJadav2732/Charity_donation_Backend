import express from "express";
// File upload functionality removed
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
	resolveParticipantId,
	getUserIdsByRole,
} from "../controllers/message.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Universal participant ID resolver (no auth needed)
router.get("/resolve-participant/:id", resolveParticipantId);

// Get User IDs by role for testing (no auth needed)
router.get("/users/:role", getUserIdsByRole);

// File upload configuration removed for simplicity

// Apply authentication middleware to all routes
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

// Search messages (optional - can be implemented later)
router.get("/search", (req, res) => {
	res.status(501).json({
		success: false,
		message: "Search functionality not implemented yet",
	});
});

export default router;
