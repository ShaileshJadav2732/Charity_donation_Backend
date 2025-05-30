import { Server } from "socket.io";
import Notification, {
	NotificationType,
	INotification,
} from "../models/notification.model";
import {
	emitNotificationToUser,
	emitNotificationToRole,
} from "../socket/socketHandler";
import mongoose from "mongoose";

interface CreateNotificationData {
	recipient: string;
	type: NotificationType;
	title: string;
	message: string;
	data?: Record<string, any>;
}

export class NotificationService {
	private io: Server;

	constructor(io: Server) {
		this.io = io;
	}

	// Create and emit a notification to a specific user
	async createAndEmitNotification(
		notificationData: CreateNotificationData
	): Promise<INotification> {
		try {
			// Create notification in database
			const notification = new Notification(notificationData);
			await notification.save();

			// Populate recipient for socket emission
			await notification.populate("recipient", "name email role");

			// Emit real-time notification
			emitNotificationToUser(this.io, notificationData.recipient, {
				id: notification._id,
				type: notification.type,
				title: notification.title,
				message: notification.message,
				data: notification.data,
				isRead: notification.isRead,
				createdAt: notification.createdAt,
				recipient: notification.recipient,
			});

			return notification;
		} catch (error) {
			throw error;
		}
	}

	// Create donation received notification
	async createDonationReceivedNotification(
		organizationId: string,
		donationData: {
			donorName: string;
			amount: number;
			cause: string;
			donationId: string;
		}
	): Promise<INotification> {
		return this.createAndEmitNotification({
			recipient: organizationId,
			type: NotificationType.DONATION_RECEIVED,
			title: "New Donation Received!",
			message: `${donationData.donorName} donated $${donationData.amount} to ${donationData.cause}`,
			data: {
				donationId: donationData.donationId,
				donorName: donationData.donorName,
				amount: donationData.amount,
				cause: donationData.cause,
			},
		});
	}

	// Create donation status update notification
	async createDonationStatusNotification(
		donorId: string,
		statusData: {
			donationId: string;
			status: string;
			organizationName: string;
			cause: string;
		}
	): Promise<INotification> {
		const statusMessages = {
			approved: "Your donation has been approved",
			received: "Your donation has been received",
			confirmed: "Your donation has been confirmed and processed",
		};

		const message =
			statusMessages[statusData.status as keyof typeof statusMessages] ||
			`Your donation status has been updated to ${statusData.status}`;

		return this.createAndEmitNotification({
			recipient: donorId,
			type: NotificationType.DONATION_STATUS_UPDATED,
			title: "Donation Status Updated",
			message: `${message} by ${statusData.organizationName}`,
			data: {
				donationId: statusData.donationId,
				status: statusData.status,
				organizationName: statusData.organizationName,
				cause: statusData.cause,
			},
		});
	}

	// Create campaign notification
	async createCampaignNotification(
		recipientId: string,
		campaignData: {
			campaignId: string;
			campaignName: string;
			organizationName: string;
			action: "created" | "updated";
		}
	): Promise<INotification> {
		const type =
			campaignData.action === "created"
				? NotificationType.CAMPAIGN_CREATED
				: NotificationType.CAMPAIGN_UPDATED;

		const title =
			campaignData.action === "created"
				? "New Campaign Created"
				: "Campaign Updated";

		const message = `${campaignData.organizationName} has ${campaignData.action} the campaign "${campaignData.campaignName}"`;

		return this.createAndEmitNotification({
			recipient: recipientId,
			type,
			title,
			message,
			data: {
				campaignId: campaignData.campaignId,
				campaignName: campaignData.campaignName,
				organizationName: campaignData.organizationName,
				action: campaignData.action,
			},
		});
	}

	// Create feedback notification
	async createFeedbackNotification(
		recipientId: string,
		feedbackData: {
			feedbackId: string;
			senderName: string;
			type: "received" | "response";
			subject?: string;
		}
	): Promise<INotification> {
		const type =
			feedbackData.type === "received"
				? NotificationType.FEEDBACK_RECEIVED
				: NotificationType.FEEDBACK_RESPONSE;

		const title =
			feedbackData.type === "received"
				? "New Feedback Received"
				: "Feedback Response";

		const message =
			feedbackData.type === "received"
				? `You received new feedback from ${feedbackData.senderName}`
				: `${feedbackData.senderName} responded to your feedback`;

		return this.createAndEmitNotification({
			recipient: recipientId,
			type,
			title,
			message,
			data: {
				feedbackId: feedbackData.feedbackId,
				senderName: feedbackData.senderName,
				subject: feedbackData.subject,
			},
		});
	}

	// Create system notification
	async createSystemNotification(
		recipientId: string,
		systemData: {
			title: string;
			message: string;
			data?: Record<string, any>;
		}
	): Promise<INotification> {
		return this.createAndEmitNotification({
			recipient: recipientId,
			type: NotificationType.SYSTEM_NOTIFICATION,
			title: systemData.title,
			message: systemData.message,
			data: systemData.data,
		});
	}

	// Broadcast notification to multiple users
	async broadcastNotification(
		recipientIds: string[],
		notificationData: Omit<CreateNotificationData, "recipient">
	): Promise<INotification[]> {
		const notifications: INotification[] = [];

		for (const recipientId of recipientIds) {
			try {
				const notification = await this.createAndEmitNotification({
					...notificationData,
					recipient: recipientId,
				});
				notifications.push(notification);
			} 
		}

		return notifications;
	}

	// Mark notification as read and emit update
	async markAsRead(
		notificationId: string,
		userId: string
	): Promise<INotification | null> {
		try {
			const notification = await Notification.findOneAndUpdate(
				{ _id: notificationId, recipient: userId },
				{ isRead: true, updatedAt: new Date() },
				{ new: true }
			);

			if (notification) {
				// Emit read status update
				emitNotificationToUser(this.io, userId, {
					type: "notification:read",
					notificationId: notificationId,
				});
			}

			return notification;
		} catch (error) {
			throw error;
		}
	}
}
