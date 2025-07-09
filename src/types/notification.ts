import { IUser } from "types";
import mongoose, { Document } from "mongoose";
export interface AuthUser extends IUser {
	id: string;
}

export interface AuthRequest extends Request {
	user?: AuthUser;
}
export enum NotificationType {
	DONATION_RECEIVED = "DONATION_RECEIVED",
	DONATION_STATUS_UPDATED = "DONATION_STATUS_UPDATED",
	CAMPAIGN_CREATED = "CAMPAIGN_CREATED",
	CAMPAIGN_UPDATED = "CAMPAIGN_UPDATED",
	FEEDBACK_RECEIVED = "FEEDBACK_RECEIVED",
	FEEDBACK_RESPONSE = "FEEDBACK_RESPONSE",
	SYSTEM_NOTIFICATION = "SYSTEM_NOTIFICATION",
	MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
	CONVERSATION_STARTED = "CONVERSATION_STARTED",
}

export interface INotification extends Document {
	recipient: mongoose.Types.ObjectId;
	type: NotificationType;
	title: string;
	message: string;
	data?: Record<string, any>;
	isRead: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateNotificationData {
	recipient: string;
	type: NotificationType;
	title: string;
	message: string;
	data?: Record<string, any>;
}
