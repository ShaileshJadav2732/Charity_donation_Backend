import { Request, Response } from "express";
import Message from "../models/message.model";
import Conversation from "../models/conversation.model";
import User from "../models/user.model";
import DonorProfile from "../models/donor.model";
import Organization from "../models/organization.model";
import Cause from "../models/cause.model";
import { AuthRequest } from "../types";
import { NotificationService } from "../services/notificationService";
import { NotificationType } from "../models/notification.model";

// Helper to get user profile
const getProfile = async (user: any) => {
	if (user.role === "donor") {
		const profile = await DonorProfile.findOne({ userId: user._id });
		return {
			name: profile
				? `${profile.firstName} ${profile.lastName}`.trim()
				: user.email,
			image: profile?.profileImage,
		};
	}
	const profile = await Organization.findOne({ userId: user._id });
	return {
		name: profile?.name || user.email,
		image: profile?.logo,
	};
};

export const getConversations = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 20;
		const unreadOnly = req.query.unreadOnly === "true";

		const conversations = await Conversation.find({
			"participants.user": userId,
			isActive: true,
		})
			.populate("participants.user", "email role")
			.populate("lastMessage", "content createdAt sender")
			.sort({ updatedAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit);

		const enriched = await Promise.all(
			conversations.map(async (conv) => {
				const participants = await Promise.all(
					conv.participants.map(async (p) => {
						const user = p.user as any;
						const profile = await getProfile(user);
						return {
							user: {
								_id: user._id,
								name: profile.name,
								role: user.role,
								profileImage: profile.image,
							},
							lastReadAt: p.lastReadAt,
						};
					})
				);
				return { ...conv.toObject(), participants };
			})
		);

		const filtered = unreadOnly
			? enriched.filter((conv) => {
					const userParticipant = conv.participants.find(
						(p) => p.user._id.toString() === userId.toString()
					);
					if (!conv.lastMessage || !userParticipant) return false;
					const lastRead = userParticipant.lastReadAt
						? new Date(userParticipant.lastReadAt)
						: new Date(0);
					return new Date((conv.lastMessage as any).createdAt) > lastRead;
				})
			: enriched;

		const total = await Conversation.countDocuments({
			"participants.user": userId,
			isActive: true,
		});

		res.json({
			success: true,
			data: filtered,
			pagination: {
				total,
				page,
				pages: Math.ceil(total / limit),
				hasMore: page < Math.ceil(total / limit),
			},
		});
	} catch (error: any) {
		res
			.status(500)
			.json({ success: false, message: "Error fetching conversations" });
	}
};

export const getConversation = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const conversation = await Conversation.findOne({
			_id: req.params.conversationId,
			"participants.user": userId,
			isActive: true,
		}).populate("participants.user", "email role");

		if (!conversation)
			return res.status(404).json({ success: false, message: "Not found" });

		const participants = await Promise.all(
			conversation.participants.map(async (p) => {
				const user = p.user as any;
				const profile = await getProfile(user);
				return {
					user: {
						_id: user._id,
						name: profile.name,
						role: user.role,
						profileImage: profile.image,
					},
					lastReadAt: p.lastReadAt,
				};
			})
		);

		res.json({
			success: true,
			data: { ...conversation.toObject(), participants },
		});
	} catch (error: any) {
		res
			.status(500)
			.json({ success: false, message: "Error fetching conversation" });
	}
};

export const getMessages = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const conversationId = req.params.conversationId;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 50;

		// Verify user is participant
		const conversation = await Conversation.findOne({
			_id: conversationId,
			"participants.user": userId,
			isActive: true,
		});
		if (!conversation)
			return res.status(404).json({ success: false, message: "Not found" });

		const messages = await Message.find({
			conversationId,
			deletedAt: { $exists: false },
		})
			.populate("sender", "email role")
			.populate("recipient", "email role")
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit);

		const enriched = await Promise.all(
			messages.map(async (msg) => {
				const sender = msg.sender as any;
				const recipient = msg.recipient as any;
				const senderProfile = await getProfile(sender);
				const recipientProfile = await getProfile(recipient);

				return {
					...msg.toObject(),
					sender: {
						_id: sender._id,
						name: senderProfile.name,
						role: sender.role,
						profileImage: senderProfile.image,
					},
					recipient: {
						_id: recipient._id,
						name: recipientProfile.name,
						role: recipient.role,
						profileImage: recipientProfile.image,
					},
				};
			})
		);

		const total = await Message.countDocuments({
			conversationId,
			deletedAt: { $exists: false },
		});

		res.json({
			success: true,
			data: enriched.reverse(),
			pagination: {
				total,
				page,
				pages: Math.ceil(total / limit),
				hasMore: page < Math.ceil(total / limit),
			},
		});
	} catch (error: any) {
		res
			.status(500)
			.json({ success: false, message: "Error fetching messages" });
	}
};

export const createConversation = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const { participantId, initialMessage } = req.body;

		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });
		if (!participantId || !initialMessage)
			return res.status(400).json({ success: false, message: "Missing data" });

		const participant = await User.findById(participantId);
		if (!participant)
			return res
				.status(404)
				.json({ success: false, message: "Participant not found" });

		// Check if conversation exists
		const existing = await Conversation.findOne({
			isActive: true,
			"participants.user": { $all: [userId, participantId] },
			$expr: { $eq: [{ $size: "$participants" }, 2] },
		});
		if (existing)
			return res.status(400).json({
				success: false,
				message: "Conversation exists",
				data: { conversationId: existing._id },
			});

		// Create conversation and message
		const conversation = await new Conversation({
			participants: [{ user: userId }, { user: participantId }],
			isActive: true,
		}).save();

		const message = await new Message({
			conversationId: conversation._id,
			sender: userId,
			recipient: participantId,
			content: initialMessage,
			messageType: "text",
			isRead: false,
		}).save();

		conversation.lastMessage = message._id as any;
		await conversation.save();

		// Send notification
		if ((req as any).app.get("io") && participantId !== userId.toString()) {
			try {
				const io = (req as any).app.get("io");
				const notificationService = new NotificationService(io);
				await notificationService.createAndEmitNotification({
					recipient: participantId,
					type: NotificationType.CONVERSATION_STARTED,
					title: "New Conversation",
					message: "Someone started a conversation with you",
					data: { conversationId: conversation._id, messageId: message._id },
				});
			} catch {}
		}

		res
			.status(201)
			.json({ success: true, data: { conversationId: conversation._id } });
	} catch (error: any) {
		res
			.status(500)
			.json({ success: false, message: "Error creating conversation" });
	}
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const { conversationId, recipientId, content } = req.body;

		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });
		if (!content || !recipientId)
			return res.status(400).json({ success: false, message: "Missing data" });

		// Find or create conversation
		let conversation: any = conversationId
			? await Conversation.findOne({
					_id: conversationId,
					"participants.user": userId,
					isActive: true,
				})
			: await Conversation.findOne({
					isActive: true,
					"participants.user": { $all: [userId, recipientId] },
					$expr: { $eq: [{ $size: "$participants" }, 2] },
				});

		if (!conversation) {
			conversation = await new Conversation({
				participants: [{ user: userId }, { user: recipientId }],
				isActive: true,
			}).save();
		}

		// Create message
		const message = await new Message({
			conversationId: conversation._id,
			sender: userId,
			recipient: recipientId,
			content,
			messageType: "text",
			isRead: false,
		}).save();

		// Update conversation
		conversation.lastMessage = message._id;
		await conversation.save();

		// Send notification
		if ((req as any).app.get("io") && recipientId !== userId.toString()) {
			try {
				const io = (req as any).app.get("io");
				io.to(`conversation_${conversation._id}`).emit("message:new", {
					messageId: message._id,
				});
				const notificationService = new NotificationService(io);
				await notificationService.createAndEmitNotification({
					recipient: recipientId,
					type: NotificationType.MESSAGE_RECEIVED,
					title: "New Message",
					message: "You have a new message",
					data: { conversationId: conversation._id, messageId: message._id },
				});
			} catch {}
		}

		res.status(201).json({ success: true, data: { messageId: message._id } });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Error sending message" });
	}
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const count = await Message.countDocuments({
			recipient: userId,
			isRead: false,
			deletedAt: { $exists: false },
		});
		res.json({ success: true, count });
	} catch (error: any) {
		res
			.status(500)
			.json({ success: false, message: "Error fetching unread count" });
	}
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const message = await Message.findOne({
			_id: req.params.messageId,
			sender: userId,
		});
		if (!message)
			return res.status(404).json({ success: false, message: "Not found" });

		message.deletedAt = new Date();
		await message.save();

		if ((req as any).app.get("io")) {
			const io = (req as any).app.get("io");
			io.to(`conversation_${message.conversationId}`).emit("message:deleted", {
				messageId: message._id,
			});
		}

		res.json({ success: true, message: "Deleted" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Error deleting message" });
	}
};

export const editMessage = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const { content } = req.body;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });
		if (!content)
			return res
				.status(400)
				.json({ success: false, message: "Content required" });

		const message = await Message.findOne({
			_id: req.params.messageId,
			sender: userId,
			deletedAt: { $exists: false },
		});
		if (!message)
			return res.status(404).json({ success: false, message: "Not found" });

		message.content = content;
		message.editedAt = new Date();
		await message.save();

		if ((req as any).app.get("io")) {
			const io = (req as any).app.get("io");
			io.to(`conversation_${message.conversationId}`).emit("message:edited", {
				messageId: message._id,
				content,
			});
		}

		res.json({ success: true, message: "Updated" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Error editing message" });
	}
};

export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const message = await Message.findOne({
			_id: req.params.messageId,
			recipient: userId,
		});
		if (!message)
			return res.status(404).json({ success: false, message: "Not found" });

		if (!message.isRead) {
			message.isRead = true;
			message.readAt = new Date();
			await message.save();

			if ((req as any).app.get("io")) {
				const io = (req as any).app.get("io");
				io.to(`conversation_${message.conversationId}`).emit("message:read", {
					messageId: message._id,
				});
			}
		}

		res.json({ success: true, message: "Marked as read" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Error marking as read" });
	}
};

export const markConversationAsRead = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const userId = req.user?._id;
		if (!userId)
			return res
				.status(401)
				.json({ success: false, message: "Not authenticated" });

		const conversation = await Conversation.findOne({
			_id: req.params.conversationId,
			"participants.user": userId,
			isActive: true,
		});
		if (!conversation)
			return res.status(404).json({ success: false, message: "Not found" });

		await Message.updateMany(
			{
				conversationId: req.params.conversationId,
				recipient: userId,
				isRead: false,
			},
			{ isRead: true, readAt: new Date() }
		);

		const participant = conversation.participants.find(
			(p) => p.user.toString() === userId.toString()
		);
		if (participant) {
			participant.lastReadAt = new Date();
			await conversation.save();
		}

		res.json({ success: true, message: "Marked as read" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Error marking as read" });
	}
};

export const resolveParticipantId = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		if (!id)
			return res.status(400).json({ success: false, message: "ID required" });

		let user = null;
		let type = "";

		// Try User ID
		try {
			user = await User.findById(id);
			if (user) type = "user";
		} catch {}

		// Try Organization ID
		if (!user) {
			try {
				const org = await Organization.findById(id);
				if (org?.userId) {
					user = await User.findById(org.userId);
					if (user) type = "organization";
				}
			} catch {}
		}

		// Try DonorProfile ID
		if (!user) {
			try {
				const donor = await DonorProfile.findById(id);
				if (donor?.userId) {
					user = await User.findById(donor.userId);
					if (user) type = "donor";
				}
			} catch {}
		}

		// Try Cause ID
		if (!user) {
			try {
				const cause = await Cause.findById(id).populate("organizationId");
				if (cause?.organizationId) {
					const org = cause.organizationId as any;
					if (org?.userId) {
						user = await User.findById(org.userId);
						if (user) type = "cause";
					}
				}
			} catch {}
		}

		if (!user)
			return res.status(404).json({ success: false, message: "ID not found" });

		res.json({
			success: true,
			data: {
				participantId: user._id,
				email: user.email,
				role: user.role,
				resolvedFrom: type,
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Error resolving ID" });
	}
};

export const getUserIdsByRole = async (req: Request, res: Response) => {
	try {
		const { role } = req.params;
		if (!role || !["donor", "organization"].includes(role)) {
			return res.status(400).json({
				success: false,
				message: 'Role must be "donor" or "organization"',
			});
		}

		const users = await User.find({ role }).select("_id email role").limit(20);
		if (!users.length)
			return res
				.status(404)
				.json({ success: false, message: `No ${role}s found` });

		const usersWithProfiles = await Promise.all(
			users.map(async (user) => {
				const profile = await getProfile(user);
				return {
					userId: user._id.toString(),
					email: user.email,
					role: user.role,
					name: profile.name,
					profileImage: profile.image,
				};
			})
		);

		res.json({
			success: true,
			data: { role, count: usersWithProfiles.length, users: usersWithProfiles },
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: `Failed to get ${req.params.role} user IDs`,
		});
	}
};
