import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import Conversation from "../models/conversation.model";
import Message from "../models/message.model";
import { AuthenticatedSocket, JwtPayload } from "../types/message";
// Store connected users
const connectedUsers = new Map<string, string>(); // userId -> socketId

// Store online users for messaging
const onlineUsers = new Map<string, { socketId: string; lastSeen: Date }>();

// Store typing users per conversation
const typingUsers = new Map<string, Set<string>>(); // conversationId -> Set of userIds

export const setupSocketIO = (io: Server) => {
	// Authentication middleware
	io.use(async (socket: AuthenticatedSocket, next) => {
		try {
			const token = socket.handshake.auth.token;

			if (!token) {
				return next(new Error("Authentication error: No token provided"));
			}

			// Verify JWT token
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

			// Get user from database
			const user = await User.findById(decoded.id);
			if (!user) {
				return next(new Error("Authentication error: User not found"));
			}

			// Attach user info to socket
			socket.userId = user._id.toString();
			socket.userRole = user.role;

			next();
		} catch (error: any) {
			next(
				new Error(`Authentication error: ${error?.message || "Unknown error"}`)
			);
		}
	});

	io.on("connection", (socket: AuthenticatedSocket) => {
		// Store user connection
		if (socket.userId) {
			connectedUsers.set(socket.userId, socket.id);

			// Add user to online users for messaging
			onlineUsers.set(socket.userId, {
				socketId: socket.id,
				lastSeen: new Date(),
			});

			// Join user to their personal room
			socket.join(`user:${socket.userId}`);

			// Join role-based rooms
			if (socket.userRole) {
				socket.join(`role:${socket.userRole}`);
			}

			// Send current online users list to the newly connected user
			const currentOnlineUsers = Array.from(onlineUsers.entries()).map(
				([userId, data]) => ({
					userId,
					isOnline: true,
					lastSeen: data.lastSeen,
				})
			);

			socket.emit("users:online-list", currentOnlineUsers);

			// Broadcast user online status for messaging to other users
			socket.broadcast.emit("user:online", {
				userId: socket.userId,
				isOnline: true,
				lastSeen: new Date(),
			});
		}

		socket.on("ping", (data) => {
			socket.emit("pong", { ...data, serverTime: Date.now() });
		});

		socket.on("notification:read", (notificationId: string) => {});

		// Handle test notifications (for development)
		socket.on("test:notification", (data) => {
			// Echo back to the same user for testing
			socket.emit("notification:new", {
				id: `test-${Date.now()}`,
				type: data.type || "SYSTEM_NOTIFICATION",
				title: data.title || "Test Notification",
				message: data.message || "This is a test notification",
				isRead: false,
				createdAt: new Date().toISOString(),
				data: { test: true },
			});
		});

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
		socket.on("typing:start", async (data: any) => {
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

		socket.on("typing:stop", async (data: any) => {
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

		// Handle disconnection
		socket.on("disconnect", async (reason) => {
			if (!socket.userId) return;

			console.log(`User ${socket.userId} disconnected: ${reason}`);

			// Remove from connected users
			connectedUsers.delete(socket.userId);

			// Remove from online users
			onlineUsers.delete(socket.userId);

			// Remove from all typing indicators
			for (const [conversationId, typingSet] of typingUsers.entries()) {
				if (typingSet.has(socket.userId)) {
					typingSet.delete(socket.userId);

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
	});
};

// Helper function to emit notification to specific user
export const emitNotificationToUser = (
	io: Server,
	userId: string,
	notification: any
) => {
	io.to(`user:${userId}`).emit("notification:new", notification);
};

// Helper function to emit notification to all users with specific role
export const emitNotificationToRole = (
	io: Server,
	role: string,
	notification: any
) => {
	io.to(`role:${role}`).emit("notification:new", notification);
};

// Helper function to emit notification to all connected users
export const emitNotificationToAll = (io: Server, notification: any) => {
	io.emit("notification:new", notification);
};

// Helper function to check if user is online
export const isUserOnline = (userId: string): boolean => {
	return connectedUsers.has(userId);
};

// Helper function to get connected users count
export const getConnectedUsersCount = (): number => {
	return connectedUsers.size;
};

// Helper function to get all connected user IDs
export const getConnectedUserIds = (): string[] => {
	return Array.from(connectedUsers.keys());
};

// Helper functions for messaging
export const getOnlineUsers = () => {
	return Array.from(onlineUsers.entries()).map(([userId, data]) => ({
		userId,
		isOnline: true,
		lastSeen: data.lastSeen,
	}));
};

export const isUserOnlineForMessaging = (userId: string) => {
	return onlineUsers.has(userId);
};

export const getTypingUsers = (conversationId: string) => {
	return Array.from(typingUsers.get(conversationId) || []);
};
