import { Request, Response } from "express";
import Notification, { NotificationType } from "../models/notification.model";

interface CreateNotificationParams {
	recipient: string;
	type: NotificationType;
	title: string;
	message: string;
	data?: Record<string, any>;
}

// Create notification (internal function)
export const createNotification = async (params: CreateNotificationParams) => {
	try {
		const notification = await Notification.create(params);
		return notification;
	} catch (error) {
		console.error("Error creating notification:", error);
		throw error;
	}
};

// Get user's notifications
export const getUserNotifications = async (req: Request, res: Response) => {
	try {
		const { page = 1, limit = 20, unreadOnly = false } = req.query;
		const query = {
			recipient: req.user!._id,
			...(unreadOnly === "true" && { isRead: false }),
		};

		const notifications = await Notification.find(query)
			.sort({ createdAt: -1 })
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit));

		const total = await Notification.countDocuments(query);
		const unreadCount = await Notification.countDocuments({
			recipient: req.user!._id,
			isRead: false,
		});

		res.status(200).json({
			success: true,
			data: notifications,
			unreadCount,
			pagination: {
				page: Number(page),
				limit: Number(limit),
				total,
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Mark notifications as read
export const markNotificationsAsRead = async (req: Request, res: Response) => {
	try {
		const { notificationIds } = req.body;

		await Notification.updateMany(
			{
				_id: { $in: notificationIds },
				recipient: req.user!._id,
			},
			{
				$set: { isRead: true },
			}
		);

		res.status(200).json({
			success: true,
			message: "Notifications marked as read",
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Delete notifications
export const deleteNotifications = async (req: Request, res: Response) => {
	try {
		const { notificationIds } = req.body;

		await Notification.deleteMany({
			_id: { $in: notificationIds },
			recipient: req.user!._id,
		});

		res.status(200).json({
			success: true,
			message: "Notifications deleted successfully",
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};
