import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/notification.model'; // Adjust path
import { IUser } from 'types';
interface AuthRequest extends Request {
	user?: IUser;
}


// Get notifications for a user
export const getNotifications = async (req: AuthRequest & { params: { userId: string }, query: { limit?: string, unreadOnly?: string } }, res: Response) => {
	try {
		const { userId } = req.params;
		const { limit = '50', unreadOnly = 'false' } = req.query;
		console.log("userId", userId);
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({ success: false, message: 'Invalid user ID' });
		}
		if (!req.user?._id || req.user._id.toString() !== userId) {
			return res.status(403).json({ success: false, message: 'Unauthorized access' });
		}

		const query: { recipient: string; isRead?: boolean } = { recipient: userId };
		if (unreadOnly === 'true') {
			query.isRead = false;
		}

		const notifications = await Notification.find(query)
			.sort({ createdAt: -1 })
			.limit(parseInt(limit as string, 10));

		res.status(200).json({ success: true, notifications });
	} catch (error: any) {
		console.error('Error fetching notifications:', error);
		res.status(500).json({
			success: false,
			message: 'Error fetching notifications',
			error: error?.message || 'Unknown error occurred',
		});
	}
};

// Mark a notification as read
export const markNotificationAsRead = async (req: AuthRequest & { params: { notificationId: string } }, res: Response) => {
	try {
		const { notificationId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(notificationId)) {
			return res.status(400).json({ success: false, message: 'Invalid notification ID' });
		}
		const notification = await Notification.findById(notificationId);
		if (!notification) {
			return res.status(404).json({ success: false, message: 'Notification not found' });
		}
		if (!req.user?._id || req.user._id.toString() !== notification.recipient.toString()) {
			return res.status(403).json({ success: false, message: 'Unauthorized access' });
		}
		notification.isRead = true;
		await notification.save();
		res.status(200).json({ success: true, notification });
	} catch (error: any) {
		console.error('Error marking notification as read:', error);
		res.status(500).json({
			success: false,
			message: 'Error marking notification as read',
			error: error?.message || 'Unknown error occurred',
		});
	}
};

// Dismiss (delete) a notification
export const dismissNotification = async (req: AuthRequest & { params: { notificationId: string } }, res: Response) => {
	try {
		const { notificationId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(notificationId)) {
			return res.status(400).json({ success: false, message: 'Invalid notification ID' });
		}
		const notification = await Notification.findById(notificationId);
		if (!notification) {
			return res.status(404).json({ success: false, message: 'Notification not found' });
		}
		if (!req.user?._id || req.user._id.toString() !== notification.recipient.toString()) {
			return res.status(403).json({ success: false, message: 'Unauthorized access' });
		}
		await notification.deleteOne();
		res.status(200).json({ success: true, notification });
	} catch (error: any) {
		console.error('Error dismissing notification:', error);
		res.status(500).json({
			success: false,
			message: 'Error dismissing notification',
			error: error?.message || 'Unknown error occurred',
		});
	}
};