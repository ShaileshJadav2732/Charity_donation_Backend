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

const NotificationSchema: Schema<INotification> = new Schema(
	{
		recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
		type: {
			type: String,
			enum: Object.values(NotificationType),
			required: true,
		},
		title: { type: String, required: true },
		message: { type: String, required: true },
		data: { type: Schema.Types.Mixed, default: {} },
		isRead: { type: Boolean, default: false },
		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now },
	},
	{
		timestamps: true, // Automatically manages createdAt and updatedAt
	}
);

// Indexes for better query performance
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ recipient: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });

// Add TTL index to automatically delete notifications after 30 days
NotificationSchema.index(
	{ createdAt: 1 },
	{ expireAfterSeconds: 30 * 24 * 60 * 60 }
);

// Pre-save hook to update updatedAt
NotificationSchema.pre("save", function (next) {
	this.updatedAt = new Date();
	next();
});

const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
export default Notification;