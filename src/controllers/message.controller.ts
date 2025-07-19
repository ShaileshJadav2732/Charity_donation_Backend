import { Request, Response } from "express";
import Message from "../models/message.model";
import Conversation from "../models/conversation.model";
import User from "../models/user.model";
import DonorProfile from "../models/donor.model";
import Organization from "../models/organization.model";
import { AuthRequest } from "../types";
import { NotificationService } from "../services/notificationService";
import { NotificationType } from "../types/notification";

// Get all conversations for the current user
export const getConversations = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 20;

		const unreadOnly = req.query.unreadOnly === "true";

		const skip = (page - 1) * limit;

		// Build query
		let query = {
			"participants.user": userId,
			isActive: true,
		};

		// Get conversations
		let conversationsQuery = Conversation.find(query)
			.populate({
				path: "participants.user",
				select: "email role",
			})
			.populate({
				path: "lastMessage",
				select: "content messageType createdAt sender isRead",
			})
			.populate({
				path: "relatedDonation",
				select: "cause amount type",
				populate: {
					path: "cause",
					select: "title",
				},
			})
			.populate({
				path: "relatedCause",
				select: "title",
			})
			.sort({ updatedAt: -1 })
			.skip(skip)
			.limit(limit);

		const conversations = await conversationsQuery.exec();

		// Get participant profiles
		const enrichedConversations = await Promise.all(
			conversations.map(async (conv) => {
				const participantsWithProfiles = await Promise.all(
					conv.participants.map(async (participant) => {
						const user = participant.user as any;
						let profileData = null;

						if (user.role === "donor") {
							profileData = await DonorProfile.findOne({ userId: user._id });
						} else if (user.role === "organization") {
							profileData = await Organization.findOne({ userId: user._id });
						}

						return {
							user: {
								_id: user._id,
								name:
									user.role === "donor"
										? `${profileData?.firstName || ""} ${profileData?.lastName || ""}`.trim() ||
											user.email
										: profileData?.name || user.email,
								role: user.role,
								profileImage:
									user.role === "donor"
										? profileData?.profileImage
										: profileData?.logo,
							},
							lastReadAt: participant.lastReadAt,
							isTyping: participant.isTyping,
						};
					})
				);

				return {
					_id: conv._id,
					participants: participantsWithProfiles,
					lastMessage: conv.lastMessage,
					relatedDonation: conv.relatedDonation,
					relatedCause: conv.relatedCause,
					isActive: conv.isActive,
					createdAt: conv.createdAt,
					updatedAt: conv.updatedAt,
				};
			})
		);

		// Filter for unread only if requested
		let filteredConversations = enrichedConversations;
		if (unreadOnly) {
			filteredConversations = enrichedConversations.filter((conv) => {
				const userParticipant = conv.participants.find(
					(p) => p.user._id.toString() === userId.toString()
				);
				if (!conv.lastMessage || !userParticipant) return false;

				const lastReadTime = userParticipant.lastReadAt
					? new Date(userParticipant.lastReadAt)
					: new Date(0);
				const lastMessageTime = new Date((conv.lastMessage as any).createdAt);

				return lastMessageTime > lastReadTime;
			});
		}

		// Get total count
		const total = await Conversation.countDocuments(query);
		const totalPages = Math.ceil(total / limit);

		res.json({
			success: true,
			data: filteredConversations,
			pagination: {
				total,
				page,
				pages: totalPages,
				hasMore: page < totalPages,
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching conversations",
			error: error.message,
		});
	}
};

// Get a specific conversation
export const getConversation = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const conversationId = req.params.conversationId;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		const conversation = await Conversation.findOne({
			_id: conversationId,
			"participants.user": userId,
			isActive: true,
		})
			.populate({
				path: "participants.user",
				select: "email role",
			})
			.populate({
				path: "lastMessage",
				select: "content messageType createdAt sender isRead",
			})
			.populate({
				path: "relatedDonation",
				select: "cause amount type",
				populate: {
					path: "cause",
					select: "title",
				},
			})
			.populate({
				path: "relatedCause",
				select: "title",
			});

		if (!conversation) {
			return res
				.status(404)
				.json({ success: false, message: "Conversation not found" });
		}

		// Enrich with profile data
		const participantsWithProfiles = await Promise.all(
			conversation.participants.map(async (participant) => {
				const user = participant.user as any;
				let profileData = null;

				if (user.role === "donor") {
					profileData = await DonorProfile.findOne({ userId: user._id });
				} else if (user.role === "organization") {
					profileData = await Organization.findOne({ userId: user._id });
				}

				return {
					user: {
						_id: user._id,
						name:
							user.role === "donor"
								? `${profileData?.firstName || ""} ${profileData?.lastName || ""}`.trim() ||
									user.email
								: profileData?.name || user.email,
						role: user.role,
						profileImage:
							user.role === "donor"
								? profileData?.profileImage
								: profileData?.logo,
					},
					lastReadAt: participant.lastReadAt,
					isTyping: participant.isTyping,
				};
			})
		);

		const enrichedConversation = {
			_id: conversation._id,
			participants: participantsWithProfiles,
			lastMessage: conversation.lastMessage,
			relatedDonation: conversation.relatedDonation,
			relatedCause: conversation.relatedCause,
			isActive: conversation.isActive,
			createdAt: conversation.createdAt,
			updatedAt: conversation.updatedAt,
		};

		res.json({
			success: true,
			data: enrichedConversation,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching conversation",
			error: error.message,
		});
	}
};

// Get messages for a conversation
export const getMessages = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const conversationId = req.params.conversationId;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 50;
		const before = req.query.before as string; // Message ID for pagination

		// Verify user is participant in conversation
		const conversation = await Conversation.findOne({
			_id: conversationId,
			"participants.user": userId,
			isActive: true,
		});

		if (!conversation) {
			return res
				.status(404)
				.json({ success: false, message: "Conversation not found" });
		}

		const skip = (page - 1) * limit;

		// Build query
		let query: any = {
			conversationId,
			deletedAt: { $exists: false },
		};

		// Add before cursor for pagination
		if (before) {
			const beforeMessage = await Message.findById(before);
			if (beforeMessage) {
				query.createdAt = { $lt: beforeMessage.createdAt };
			}
		}

		// Get messages
		const messages = await Message.find(query)
			.populate({
				path: "sender",
				select: "email role",
			})
			.populate({
				path: "recipient",
				select: "email role",
			})
			.populate({
				path: "replyTo",
				select: "content sender createdAt",
				populate: {
					path: "sender",
					select: "email role",
				},
			})
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit);

		// Enrich messages with profile data
		const enrichedMessages = await Promise.all(
			messages.map(async (message) => {
				const sender = message.sender as any;
				const recipient = message.recipient as any;

				// Get sender profile
				let senderProfile = null;
				if (sender.role === "donor") {
					senderProfile = await DonorProfile.findOne({ userId: sender._id });
				} else if (sender.role === "organization") {
					senderProfile = await Organization.findOne({ userId: sender._id });
				}

				// Get recipient profile
				let recipientProfile = null;
				if (recipient.role === "donor") {
					recipientProfile = await DonorProfile.findOne({
						userId: recipient._id,
					});
				} else if (recipient.role === "organization") {
					recipientProfile = await Organization.findOne({
						userId: recipient._id,
					});
				}

				return {
					_id: message._id,
					conversationId: message.conversationId,
					sender: {
						_id: sender._id,
						name:
							sender.role === "donor"
								? `${senderProfile?.firstName || ""} ${senderProfile?.lastName || ""}`.trim() ||
									sender.email
								: senderProfile?.name || sender.email,
						role: sender.role,
						profileImage:
							sender.role === "donor"
								? senderProfile?.profileImage
								: senderProfile?.logo,
					},
					recipient: {
						_id: recipient._id,
						name:
							recipient.role === "donor"
								? `${recipientProfile?.firstName || ""} ${recipientProfile?.lastName || ""}`.trim() ||
									recipient.email
								: recipientProfile?.name || recipient.email,
						role: recipient.role,
						profileImage:
							recipient.role === "donor"
								? recipientProfile?.profileImage
								: recipientProfile?.logo,
					},
					content: message.content,
					messageType: message.messageType,
					attachments: message.attachments,
					isRead: message.isRead,
					readAt: message.readAt,
					editedAt: message.editedAt,
					replyTo: message.replyTo,
					createdAt: message.createdAt,
					updatedAt: message.updatedAt,
				};
			})
		);

		// Reverse to get chronological order
		enrichedMessages.reverse();

		// Get total count
		const total = await Message.countDocuments({
			conversationId,
			deletedAt: { $exists: false },
		});
		const totalPages = Math.ceil(total / limit);

		res.json({
			success: true,
			data: enrichedMessages,
			pagination: {
				total,
				page,
				pages: totalPages,
				hasMore: page < totalPages,
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching messages",
			error: error.message,
		});
	}
};

// Create a new conversation
export const createConversation = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;

		const { participantId, initialMessage, relatedDonation, relatedCause } =
			req.body;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		if (!participantId || !initialMessage) {
			return res.status(400).json({
				success: false,
				message: "Participant ID and initial message are required",
			});
		}

		// Check if participant exists (should be a User ID now)
		const participant = await User.findById(participantId);

		if (!participant) {
			return res
				.status(404)
				.json({ success: false, message: "Participant not found" });
		}

		// Check if conversation already exists between these users
		const existingConversation = await Conversation.findOne({
			isActive: true,
			"participants.user": { $all: [userId, participantId] },
			$expr: { $eq: [{ $size: "$participants" }, 2] },
		});

		if (existingConversation) {
			return res.status(400).json({
				success: false,
				message: "Conversation already exists between these users",
				data: { conversationId: existingConversation._id },
			});
		}

		// Create new conversation
		const conversation = new Conversation({
			participants: [{ user: userId }, { user: participantId }],
			relatedDonation: relatedDonation || undefined,
			relatedCause: relatedCause || undefined,
			isActive: true,
		});

		await conversation.save();

		// Create initial message
		const message = new Message({
			conversationId: conversation._id,
			sender: userId,
			recipient: participantId,
			content: initialMessage,
			messageType: "text",
			isRead: false,
		});

		await message.save();

		// Update conversation with last message
		conversation.lastMessage = message._id as any;
		await conversation.save();

		// Populate conversation data
		const populatedConversation = await Conversation.findById(conversation._id)
			.populate({
				path: "participants.user",
				select: "email role",
			})
			.populate({
				path: "lastMessage",
				select: "content messageType createdAt sender isRead",
			});

		// Enrich with profile data
		const participantsWithProfiles = await Promise.all(
			populatedConversation!.participants.map(async (participant) => {
				const user = participant.user as any;
				let profileData = null;

				if (user.role === "donor") {
					profileData = await DonorProfile.findOne({ userId: user._id });
				} else if (user.role === "organization") {
					profileData = await Organization.findOne({ userId: user._id });
				}

				return {
					user: {
						_id: user._id,
						name:
							user.role === "donor"
								? `${profileData?.firstName || ""} ${profileData?.lastName || ""}`.trim() ||
									user.email
								: profileData?.name || user.email,
						role: user.role,
						profileImage:
							user.role === "donor"
								? profileData?.profileImage
								: profileData?.logo,
					},
					lastReadAt: participant.lastReadAt,
					isTyping: participant.isTyping,
				};
			})
		);

		const enrichedConversation = {
			_id: populatedConversation!._id,
			participants: participantsWithProfiles,
			lastMessage: populatedConversation!.lastMessage,
			relatedDonation: populatedConversation!.relatedDonation,
			relatedCause: populatedConversation!.relatedCause,
			isActive: populatedConversation!.isActive,
			createdAt: populatedConversation!.createdAt,
			updatedAt: populatedConversation!.updatedAt,
		};

		// Send real-time notification to participant (only if participant is not the sender)
		if ((req as any).app.get("io") && participantId !== userId.toString()) {
			const io = (req as any).app.get("io");
			const notificationService = new NotificationService(io);

			try {
				const senderName = participantsWithProfiles.find(
					(p) => p.user._id.toString() === userId.toString()
				)?.user.name;

				// Send conversation started notification
				await notificationService.createAndEmitNotification({
					recipient: participantId,
					type: NotificationType.CONVERSATION_STARTED,
					title: "New Conversation Started",
					message: `${senderName} started a conversation with you`,
					data: {
						conversationId: conversation._id,
						messageId: message._id,
						senderName: senderName,
					},
				});

				// Also send message received notification
				await notificationService.createAndEmitNotification({
					recipient: participantId,
					type: NotificationType.MESSAGE_RECEIVED,
					title: "New Message",
					message: `You have a new message from ${senderName}`,
					data: {
						conversationId: conversation._id,
						messageId: message._id,
						senderName: senderName,
					},
				});
			} catch (notificationError) {}
		}

		res.status(201).json({
			success: true,
			data: enrichedConversation,
			message: "Conversation created successfully",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error creating conversation",
			error: error.message,
		});
	}
};

// Send a message
export const sendMessage = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const {
			conversationId,
			recipientId,
			content,
			messageType = "text",
			replyTo,
		} = req.body;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		if (!content || !recipientId) {
			return res.status(400).json({
				success: false,
				message: "Content and recipient ID are required",
			});
		}

		let conversation;

		// If conversationId provided, verify it exists and user is participant
		if (conversationId) {
			conversation = await Conversation.findOne({
				_id: conversationId,
				"participants.user": userId,
				isActive: true,
			});

			if (!conversation) {
				return res
					.status(404)
					.json({ success: false, message: "Conversation not found" });
			}
		} else {
			// Find or create conversation between users
			conversation = await Conversation.findOne({
				isActive: true,
				"participants.user": { $all: [userId, recipientId] },
				$expr: { $eq: [{ $size: "$participants" }, 2] },
			});

			if (!conversation) {
				// Create new conversation
				conversation = new Conversation({
					participants: [{ user: userId }, { user: recipientId }],
					isActive: true,
				});
				await conversation.save();
			}
		}

		// File attachments removed for simplicity

		// Create message
		const message = new Message({
			conversationId: conversation._id,
			sender: userId,
			recipient: recipientId,
			content,
			messageType: "text", // Only text messages supported
			replyTo: replyTo || undefined,
			isRead: false,
		});

		await message.save();

		// Update conversation
		conversation.lastMessage = message._id as any;
		conversation.updatedAt = new Date();
		await conversation.save();

		// Populate message data
		const populatedMessage = await Message.findById(message._id)
			.populate({
				path: "sender",
				select: "email role",
			})
			.populate({
				path: "recipient",
				select: "email role",
			});

		// Enrich with profile data
		const sender = populatedMessage!.sender as any;
		const recipient = populatedMessage!.recipient as any;

		let senderProfile = null;
		if (sender.role === "donor") {
			senderProfile = await DonorProfile.findOne({ userId: sender._id });
		} else if (sender.role === "organization") {
			senderProfile = await Organization.findOne({ userId: sender._id });
		}

		let recipientProfile = null;
		if (recipient.role === "donor") {
			recipientProfile = await DonorProfile.findOne({ userId: recipient._id });
		} else if (recipient.role === "organization") {
			recipientProfile = await Organization.findOne({ userId: recipient._id });
		}

		const enrichedMessage = {
			_id: populatedMessage!._id,
			conversationId: populatedMessage!.conversationId,
			sender: {
				_id: sender._id,
				name:
					sender.role === "donor"
						? `${senderProfile?.firstName || ""} ${senderProfile?.lastName || ""}`.trim() ||
							sender.email
						: senderProfile?.name || sender.email,
				role: sender.role,
				profileImage:
					sender.role === "donor"
						? senderProfile?.profileImage
						: senderProfile?.logo,
			},
			recipient: {
				_id: recipient._id,
				name:
					recipient.role === "donor"
						? `${recipientProfile?.firstName || ""} ${recipientProfile?.lastName || ""}`.trim() ||
							recipient.email
						: recipientProfile?.name || recipient.email,
				role: recipient.role,
				profileImage:
					recipient.role === "donor"
						? recipientProfile?.profileImage
						: recipientProfile?.logo,
			},
			content: populatedMessage!.content,
			messageType: populatedMessage!.messageType,
			attachments: populatedMessage!.attachments,
			isRead: populatedMessage!.isRead,
			readAt: populatedMessage!.readAt,
			editedAt: populatedMessage!.editedAt,
			replyTo: populatedMessage!.replyTo,
			createdAt: populatedMessage!.createdAt,
			updatedAt: populatedMessage!.updatedAt,
		};

		// Send real-time notification
		if ((req as any).app.get("io")) {
			const io = (req as any).app.get("io");

			// Emit message to conversation room
			io.to(`conversation_${conversation._id}`).emit(
				"message:new",
				enrichedMessage
			);

			// Send notification to recipient (only if recipient is not the sender)
			if (recipientId !== userId.toString()) {
				const notificationService = new NotificationService(io);
				try {
					await notificationService.createAndEmitNotification({
						recipient: recipientId,
						type: NotificationType.MESSAGE_RECEIVED,
						title: "New Message",
						message: `You have a new message from ${enrichedMessage.sender.name}`,
						data: {
							conversationId: conversation._id,
							messageId: message._id,
							senderName: enrichedMessage.sender.name,
						},
					});
				} catch (notificationError) {
					console.error(
						"Failed to send message notification:",
						notificationError
					);
				}
			} else {
			}
		}

		res.status(201).json({
			success: true,
			data: enrichedMessage,
			message: "Message sent successfully",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error sending message",
			error: error.message,
		});
	}
};

// Get unread message count
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		const count = await Message.countDocuments({
			recipient: userId,
			isRead: false,
			deletedAt: { $exists: false },
		});

		res.json({
			success: true,
			count,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching unread count",
			error: error.message,
		});
	}
};

// Delete a message
export const deleteMessage = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const messageId = req.params.messageId;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		const message = await Message.findOne({
			_id: messageId,
			sender: userId,
		});

		if (!message) {
			return res
				.status(404)
				.json({ success: false, message: "Message not found or unauthorized" });
		}

		// Soft delete
		message.deletedAt = new Date();
		await message.save();

		// Emit deletion event
		if ((req as any).app.get("io")) {
			const io = (req as any).app.get("io");
			io.to(`conversation_${message.conversationId}`).emit("message:deleted", {
				messageId: message._id,
				conversationId: message.conversationId,
			});
		}

		res.json({
			success: true,
			message: "Message deleted successfully",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error deleting message",
			error: error.message,
		});
	}
};

// Edit a message
export const editMessage = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const messageId = req.params.messageId;
		const { content } = req.body;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		if (!content) {
			return res
				.status(400)
				.json({ success: false, message: "Content is required" });
		}

		const message = await Message.findOne({
			_id: messageId,
			sender: userId,
			deletedAt: { $exists: false },
		});

		if (!message) {
			return res
				.status(404)
				.json({ success: false, message: "Message not found or unauthorized" });
		}

		message.content = content;
		message.editedAt = new Date();
		await message.save();

		// Populate message data
		const populatedMessage = await Message.findById(message._id)
			.populate({
				path: "sender",
				select: "email role",
			})
			.populate({
				path: "recipient",
				select: "email role",
			});

		// Enrich with profile data (similar to sendMessage)
		const sender = populatedMessage!.sender as any;
		const recipient = populatedMessage!.recipient as any;

		let senderProfile = null;
		if (sender.role === "donor") {
			senderProfile = await DonorProfile.findOne({ userId: sender._id });
		} else if (sender.role === "organization") {
			senderProfile = await Organization.findOne({ userId: sender._id });
		}

		let recipientProfile = null;
		if (recipient.role === "donor") {
			recipientProfile = await DonorProfile.findOne({ userId: recipient._id });
		} else if (recipient.role === "organization") {
			recipientProfile = await Organization.findOne({ userId: recipient._id });
		}

		const enrichedMessage = {
			_id: populatedMessage!._id,
			conversationId: populatedMessage!.conversationId,
			sender: {
				_id: sender._id,
				name:
					sender.role === "donor"
						? `${senderProfile?.firstName || ""} ${senderProfile?.lastName || ""}`.trim() ||
							sender.email
						: senderProfile?.name || sender.email,
				role: sender.role,
				profileImage:
					sender.role === "donor"
						? senderProfile?.profileImage
						: senderProfile?.logo,
			},
			recipient: {
				_id: recipient._id,
				name:
					recipient.role === "donor"
						? `${recipientProfile?.firstName || ""} ${recipientProfile?.lastName || ""}`.trim() ||
							recipient.email
						: recipientProfile?.name || recipient.email,
				role: recipient.role,
				profileImage:
					recipient.role === "donor"
						? recipientProfile?.profileImage
						: recipientProfile?.logo,
			},
			content: populatedMessage!.content,
			messageType: populatedMessage!.messageType,
			attachments: populatedMessage!.attachments,
			isRead: populatedMessage!.isRead,
			readAt: populatedMessage!.readAt,
			editedAt: populatedMessage!.editedAt,
			replyTo: populatedMessage!.replyTo,
			createdAt: populatedMessage!.createdAt,
			updatedAt: populatedMessage!.updatedAt,
		};

		// Emit edit event
		if ((req as any).app.get("io")) {
			const io = (req as any).app.get("io");
			io.to(`conversation_${message.conversationId}`).emit(
				"message:edited",
				enrichedMessage
			);
		}

		res.json({
			success: true,
			data: enrichedMessage,
			message: "Message updated successfully",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error editing message",
			error: error.message,
		});
	}
};

// Mark message as read
export const markMessageAsRead = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?._id;
		const messageId = req.params.messageId;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		const message = await Message.findOne({
			_id: messageId,
			recipient: userId,
		});

		if (!message) {
			return res
				.status(404)
				.json({ success: false, message: "Message not found" });
		}

		if (!message.isRead) {
			message.isRead = true;
			message.readAt = new Date();
			await message.save();

			// Emit read receipt
			if ((req as any).app.get("io")) {
				const io = (req as any).app.get("io");
				io.to(`conversation_${message.conversationId}`).emit("message:read", {
					messageId: message._id,
					conversationId: message.conversationId,
					userId,
					readAt: message.readAt,
				});
			}
		}

		res.json({
			success: true,
			message: "Message marked as read",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error marking message as read",
			error: error.message,
		});
	}
};

// Mark all messages in conversation as read
export const markConversationAsRead = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const userId = req.user?._id;
		const conversationId = req.params.conversationId;

		if (!userId) {
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });
		}

		// Verify user is participant
		const conversation = await Conversation.findOne({
			_id: conversationId,
			"participants.user": userId,
			isActive: true,
		});

		if (!conversation) {
			return res
				.status(404)
				.json({ success: false, message: "Conversation not found" });
		}

		// Mark all unread messages as read
		await Message.updateMany(
			{
				conversationId,
				recipient: userId,
				isRead: false,
			},
			{
				isRead: true,
				readAt: new Date(),
			}
		);

		// Update participant's last read time
		const participant = conversation.participants.find(
			(p) => p.user.toString() === userId.toString()
		);
		if (participant) {
			participant.lastReadAt = new Date();
			await conversation.save();
		}

		res.json({
			success: true,
			message: "Conversation marked as read",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error marking conversation as read",
			error: error.message,
		});
	}
};

export const getUserIdsByRole = async (req: Request, res: Response) => {
	try {
		const { role } = req.params; // 'donor' or 'organization'

		if (!role || !["donor", "organization"].includes(role)) {
			return res.status(400).json({
				success: false,
				message: 'Role parameter must be "donor" or "organization"',
			});
		}

		// Get users by role
		const users = await User.find({ role })
			.select("_id email role profileCompleted")
			.limit(20);

		if (!users || users.length === 0) {
			return res.status(404).json({
				success: false,
				message: `No ${role}s found in the system`,
			});
		}

		// For donors, also get their profile info
		let usersWithProfiles = [];

		if (role === "donor") {
			for (const user of users) {
				const donorProfile = await DonorProfile.findOne({ userId: user._id });
				usersWithProfiles.push({
					userId: user._id.toString(),
					email: user.email,
					role: user.role,
					profileCompleted: user.profileCompleted,
					name: donorProfile
						? `${donorProfile.firstName} ${donorProfile.lastName}`
						: user.email,
					profileImage: donorProfile?.profileImage || null,
					hasProfile: !!donorProfile,
				});
			}
		} else {
			// For organizations, get their organization profile info
			for (const user of users) {
				const organization = await Organization.findOne({ userId: user._id });
				usersWithProfiles.push({
					userId: user._id.toString(),
					email: user.email,
					role: user.role,
					profileCompleted: user.profileCompleted,
					name: organization?.name || user.email,
					organizationId: organization?._id?.toString() || null,
					verified: organization?.verified || false,
					hasProfile: !!organization,
				});
			}
		}

		res.status(200).json({
			success: true,
			data: {
				role,
				count: usersWithProfiles.length,
				users: usersWithProfiles,
			},
		});
	} catch (error: any) {
		console.error(`Error getting ${req.params.role} user IDs:`, error);
		res.status(500).json({
			success: false,
			message: `Failed to get ${req.params.role} user IDs`,
			error: error.message,
		});
	}
};
