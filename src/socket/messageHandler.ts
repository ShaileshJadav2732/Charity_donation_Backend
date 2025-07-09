import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Conversation from "../models/conversation.model";
import Message from "../models/message.model";
import { AuthenticatedSocket, TypingData } from "../types/message";
// Store online users
const onlineUsers = new Map<string, { socketId: string; lastSeen: Date }>();

// Store typing users per conversation
const typingUsers = new Map<string, Set<string>>(); // conversationId -> Set of userIds

export const setupMessageHandlers = (io: Server) => {
	io.on("connection", async (socket: AuthenticatedSocket) => {
		console.log("User connected to messaging:", socket.id);

		// Authenticate user
		try {
			const token =
				socket.handshake.auth.token ||
				socket.handshake.headers.authorization?.split(" ")[1];

			if (!token) {
				socket.emit("error", { message: "Authentication required" });
				socket.disconnect();
				return;
			}

			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
			const user = await User.findById(decoded.id);

			if (!user) {
				socket.emit("error", { message: "User not found" });
				socket.disconnect();
				return;
			}

			socket.userId = user._id.toString();
			socket.userRole = user.role;

			// Add user to online users
			onlineUsers.set(socket.userId, {
				socketId: socket.id,
				lastSeen: new Date(),
			});

			// Broadcast user online status
			socket.broadcast.emit("user:online", {
				userId: socket.userId,
				isOnline: true,
				lastSeen: new Date(),
			});

			console.log(`User ${socket.userId} connected to messaging`);
		} catch (error) {
			console.error("Socket authentication error:", error);
			socket.emit("error", { message: "Authentication failed" });
			socket.disconnect();
			return;
		}

		// Join conversation room
		socket.on("conversation:join", async (conversationId: string) => {
			try {
				if (!socket.userId) return;

				// Verify user is participant in conversation
				const conversation = await Conversation.findOne({
					_id: conversationId,
					"participants.user": socket.userId,
					isActive: true,
				});

				if (!conversation) {
					socket.emit("error", {
						message: "Conversation not found or access denied",
					});
					return;
				}

				// Join the conversation room
				socket.join(`conversation_${conversationId}`);

				console.log(
					`User ${socket.userId} joined conversation ${conversationId}`
				);

				// Emit confirmation
				socket.emit("conversation:joined", { conversationId });
			} catch (error) {
				console.error("Error joining conversation:", error);
				socket.emit("error", { message: "Failed to join conversation" });
			}
		});

		// Leave conversation room
		socket.on("conversation:leave", (conversationId: string) => {
			socket.leave(`conversation_${conversationId}`);
			console.log(`User ${socket.userId} left conversation ${conversationId}`);
		});

		// Handle typing indicators
		socket.on("typing:start", async (data: TypingData) => {
			try {
				if (!socket.userId || socket.userId !== data.userId) return;

				// Verify user is participant in conversation
				const conversation = await Conversation.findOne({
					_id: data.conversationId,
					"participants.user": socket.userId,
					isActive: true,
				});

				if (!conversation) return;

				// Add user to typing users for this conversation
				if (!typingUsers.has(data.conversationId)) {
					typingUsers.set(data.conversationId, new Set());
				}
				typingUsers.get(data.conversationId)!.add(socket.userId);

				// Update conversation typing status
				// await conversation.setTypingStatus(socket.userId, true);

				// Broadcast typing indicator to other participants
				socket.to(`conversation_${data.conversationId}`).emit("typing:start", {
					conversationId: data.conversationId,
					userId: socket.userId,
					userName: data.userName,
					isTyping: true,
				});

				console.log(
					`User ${socket.userId} started typing in conversation ${data.conversationId}`
				);
			} catch (error) {
				console.error("Error handling typing start:", error);
			}
		});

		socket.on("typing:stop", async (data: TypingData) => {
			try {
				if (!socket.userId || socket.userId !== data.userId) return;

				// Verify user is participant in conversation
				const conversation = await Conversation.findOne({
					_id: data.conversationId,
					"participants.user": socket.userId,
					isActive: true,
				});

				if (!conversation) return;

				// Remove user from typing users for this conversation
				if (typingUsers.has(data.conversationId)) {
					typingUsers.get(data.conversationId)!.delete(socket.userId);
					if (typingUsers.get(data.conversationId)!.size === 0) {
						typingUsers.delete(data.conversationId);
					}
				}

				// Broadcast typing stop to other participants
				socket.to(`conversation_${data.conversationId}`).emit("typing:stop", {
					conversationId: data.conversationId,
					userId: socket.userId,
					userName: data.userName,
					isTyping: false,
				});

				console.log(
					`User ${socket.userId} stopped typing in conversation ${data.conversationId}`
				);
			} catch (error) {
				console.error("Error handling typing stop:", error);
			}
		});

		// Handle message read receipts
		socket.on(
			"message:read",
			async (data: { messageId: string; conversationId: string }) => {
				try {
					if (!socket.userId) return;

					const message = await Message.findOne({
						_id: data.messageId,
						recipient: socket.userId,
					});

					if (!message || message.isRead) return;

					// Mark message as read
					message.isRead = true;
					message.readAt = new Date();
					await message.save();

					// Broadcast read receipt to conversation
					io.to(`conversation_${data.conversationId}`).emit("message:read", {
						messageId: data.messageId,
						conversationId: data.conversationId,
						userId: socket.userId,
						readAt: message.readAt,
					});

					console.log(
						`Message ${data.messageId} marked as read by user ${socket.userId}`
					);
				} catch (error) {
					console.error("Error handling message read:", error);
				}
			}
		);

		// Handle user status updates
		socket.on("user:status", (data: { status: "online" | "away" | "busy" }) => {
			if (!socket.userId) return;

			// Update user status
			const userStatus = onlineUsers.get(socket.userId);
			if (userStatus) {
				userStatus.lastSeen = new Date();
				onlineUsers.set(socket.userId, userStatus);
			}

			// Broadcast status update
			socket.broadcast.emit("user:status", {
				userId: socket.userId,
				status: data.status,
				lastSeen: new Date(),
			});
		});

		// Handle disconnect
		socket.on("disconnect", async () => {
			if (!socket.userId) return;

			console.log(`User ${socket.userId} disconnected from messaging`);

			// Remove from online users
			onlineUsers.delete(socket.userId);

			// Remove from all typing indicators
			for (const [conversationId, typingSet] of typingUsers.entries()) {
				if (typingSet.has(socket.userId)) {
					typingSet.delete(socket.userId);

					// Update conversation typing status
					try {
						const conversation = await Conversation.findById(conversationId);
						if (conversation) {
							// await conversation.setTypingStatus(socket.userId, false);
						}
					} catch (error) {
						console.error("Error updating typing status on disconnect:", error);
					}

					// Broadcast typing stop
					socket.to(`conversation_${conversationId}`).emit("typing:stop", {
						conversationId,
						userId: socket.userId,
						isTyping: false,
					});

					if (typingSet.size === 0) {
						typingUsers.delete(conversationId);
					}
				}
			}

			// Broadcast user offline status
			socket.broadcast.emit("user:offline", {
				userId: socket.userId,
				isOnline: false,
				lastSeen: new Date(),
			});
		});

		// Handle errors
		socket.on("error", (error) => {
			console.error("Socket error:", error);
		});
	});
};

// Helper function to get online users
export const getOnlineUsers = () => {
	return Array.from(onlineUsers.entries()).map(([userId, data]) => ({
		userId,
		isOnline: true,
		lastSeen: data.lastSeen,
	}));
};

// Helper function to check if user is online
export const isUserOnline = (userId: string) => {
	return onlineUsers.has(userId);
};

// Helper function to get typing users for a conversation
export const getTypingUsers = (conversationId: string) => {
	return Array.from(typingUsers.get(conversationId) || []);
};
