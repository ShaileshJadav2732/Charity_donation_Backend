import mongoose, { Schema, Document } from "mongoose";

export enum NotificationType {
	DONATION_RECEIVED = "DONATION_RECEIVED",
	DONATION_STATUS_UPDATED = "DONATION_STATUS_UPDATED",
	CAMPAIGN_CREATED = "CAMPAIGN_CREATED",
	CAMPAIGN_UPDATED = "CAMPAIGN_UPDATED",
	FEEDBACK_RECEIVED = "FEEDBACK_RECEIVED",
	FEEDBACK_RESPONSE = "FEEDBACK_RESPONSE",
	SYSTEM_NOTIFICATION = "SYSTEM_NOTIFICATION",
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

const NotificationSchema: Schema = new Schema(
	{
		recipient: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "Recipient is required"],
		},
		type: {
			type: String,
			enum: Object.values(NotificationType),
			required: [true, "Notification type is required"],
		},
		title: {
			type: String,
			required: [true, "Title is required"],
			trim: true,
		},
		message: {
			type: String,
			required: [true, "Message is required"],
			trim: true,
		},
		data: {
			type: Schema.Types.Mixed,
			default: {},
		},
		isRead: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ recipient: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });

// Add TTL index to automatically delete old notifications after 30 days
NotificationSchema.index(
	{ createdAt: 1 },
	{ expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export default mongoose.model<INotification>(
	"Notification",
	NotificationSchema
);
