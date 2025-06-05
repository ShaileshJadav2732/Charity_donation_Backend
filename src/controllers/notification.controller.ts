import { Request, Response } from "express";
import mongoose from "mongoose";
import Notification from "../models/notification.model";
import { IUser } from "types";

interface AuthUser extends IUser {
	id: string;
}

interface AuthRequest extends Request {
	user?: AuthUser;
}

// Helper functions
const validateObjectId = (id: string, type: string) => {
	if (!mongoose.Types.ObjectId.isValid(id)) {
		throw new Error(`Invalid ${type} ID`);
	}
};

const checkAuthorization = (req: AuthRequest, targetId: string) => {
	if (!req.user?._id || req.user._id.toString() !== targetId) {
		throw new Error("Unauthorized access");
	}
};

const handleError = (res: Response, message: string, error?: any) => {
	res.status(500).json({
		success: false,
		message,
		error: error?.message || "Unknown error occurred",
	});
};

export const getNotifications = async (
	req: AuthRequest & {
		params: { userId: string };
		query: { limit?: string; unreadOnly?: string };
	},
	res: Response
) => {
	try {
		const { userId } = req.params;
		const { limit = "50", unreadOnly = "false" } = req.query;

		validateObjectId(userId, "user");
		checkAuthorization(req, userId);

		const query: { recipient: string; isRead?: boolean } = {
			recipient: userId,
		};
		if (unreadOnly === "true") query.isRead = false;

		const notifications = await Notification.find(query)
			.sort({ createdAt: -1 })
			.limit(parseInt(limit as string, 10));

		res.status(200).json({ success: true, notifications });
	} catch (error: any) {
		if (
			error.message.includes("Invalid") ||
			error.message.includes("Unauthorized")
		) {
			return res
				.status(error.message.includes("Invalid") ? 400 : 403)
				.json({ success: false, message: error.message });
		}
		handleError(res, "Error fetching notifications", error);
	}
};

const processNotification = async (
	req: AuthRequest,
	res: Response,
	action: "read" | "dismiss"
) => {
	try {
		const { notificationId } = req.params;
		validateObjectId(notificationId, "notification");

		const notification = await Notification.findById(notificationId);
		if (!notification) {
			return res
				.status(404)
				.json({ success: false, message: "Notification not found" });
		}

		checkAuthorization(req, notification.recipient.toString());

		if (action === "read") {
			notification.isRead = true;
			await notification.save();
		} else {
			await notification.deleteOne();
		}

		res.status(200).json({ success: true, notification });
	} catch (error: any) {
		if (
			error.message.includes("Invalid") ||
			error.message.includes("Unauthorized")
		) {
			return res
				.status(error.message.includes("Invalid") ? 400 : 403)
				.json({ success: false, message: error.message });
		}
		handleError(
			res,
			`Error ${action === "read" ? "marking notification as read" : "dismissing notification"}`,
			error
		);
	}
};

export const markNotificationAsRead = async (
	req: AuthRequest & { params: { notificationId: string } },
	res: Response
) => processNotification(req, res, "read");

export const dismissNotification = async (
	req: AuthRequest & { params: { notificationId: string } },
	res: Response
) => processNotification(req, res, "dismiss");
