import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

interface AuthenticatedSocket extends Socket {
	userId?: string;
	userRole?: string;
}

interface JwtPayload {
	id: string;
	role: string;
}

// Store connected users
const connectedUsers = new Map<string, string>(); // userId -> socketId

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

			// Join user to their personal room
			socket.join(`user:${socket.userId}`);

			// Join role-based rooms
			if (socket.userRole) {
				socket.join(`role:${socket.userRole}`);
			}
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

		// Handle typing indicators (for future chat features)
		socket.on("typing:start", (data) => {
			socket.broadcast.emit("typing:start", {
				userId: socket.userId,
				...data,
			});
		});

		socket.on("typing:stop", (data) => {
			socket.broadcast.emit("typing:stop", {
				userId: socket.userId,
				...data,
			});
		});

		// Handle disconnection
		socket.on("disconnect", (reason) => {
			if (socket.userId) {
				connectedUsers.delete(socket.userId);
			}
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
