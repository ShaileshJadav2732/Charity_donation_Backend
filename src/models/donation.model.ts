import mongoose, { Schema, Document } from "mongoose";

export enum DonationType {
	MONEY = "MONEY",
	CLOTHES = "CLOTHES",
	BLOOD = "BLOOD",
	FOOD = "FOOD",
	TOYS = "TOYS",
	BOOKS = "BOOKS",
	FURNITURE = "FURNITURE",
	HOUSEHOLD = "HOUSEHOLD",
	OTHER = "OTHER",
}

export enum DonationStatus {
	PENDING = "PENDING",
	APPROVED = "APPROVED",
	RECEIVED = "RECEIVED",
	CONFIRMED = "CONFIRMED",
	CANCELLED = "CANCELLED",
}

export interface IDonation extends Document {
	donor: mongoose.Types.ObjectId;
	organization: mongoose.Types.ObjectId;
	campaign?: mongoose.Types.ObjectId;
	cause?: mongoose.Types.ObjectId;
	type: DonationType;
	status: DonationStatus;
	amount?: number; // For monetary donations
	description: string;
	quantity?: number;
	unit?: string;
	scheduledDate?: Date;
	scheduledTime?: string;
	pickupAddress?: {
		street: string;
		city: string;
		state: string;
		zipCode: string;
		country: string;
	};
	dropoffAddress?: {
		street: string;
		city: string;
		state: string;
		zipCode: string;
		country: string;
	};
	isPickup: boolean;
	contactPhone: string;
	contactEmail: string;
	receiptImage?: string;
	receiptImageMetadata?: {
		originalName?: string;
		mimeType?: string;
		fileSize?: number;
		uploadedAt?: Date;
		uploadedBy?: mongoose.Types.ObjectId;
	};
	pdfReceiptUrl?: string;
	confirmationDate?: Date;
	notes?: string;
	paymentIntentId?: string; // Stripe payment intent ID
	paymentStatus?: string; // Stripe payment status
	createdAt: Date;
	updatedAt: Date;
}

const DonationSchema: Schema = new Schema(
	{
		donor: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		organization: {
			type: Schema.Types.ObjectId,
			ref: "Organization",
			required: true,
		},
		campaign: {
			type: Schema.Types.ObjectId,
			ref: "Campaign",
		},
		cause: {
			type: Schema.Types.ObjectId,
			ref: "Cause",
		},
		type: {
			type: String,
			enum: Object.values(DonationType),
			required: function (this: { type: DonationType }) {
				return this.type === DonationType.MONEY;
			},
		},
		status: {
			type: String,
			enum: Object.values(DonationStatus),
			default: DonationStatus.PENDING,
		},
		amount: {
			type: Number,
			required: function (this: { type: DonationType }) {
				return this.type === DonationType.MONEY;
			},
		},
		description: {
			type: String,
			required: true,
		},
		quantity: {
			type: Number,
			required: function (this: { type: DonationType }) {
				return this.type !== DonationType.MONEY;
			},
		},
		unit: {
			type: String,
			required: function (this: { type: DonationType }) {
				return this.type !== DonationType.MONEY;
			},
		},
		scheduledDate: {
			type: Date,
			required: function (this: { type: DonationType }) {
				return this.type !== DonationType.MONEY;
			},
		},
		scheduledTime: {
			type: String,
			required: function (this: { type: DonationType }) {
				return this.type !== DonationType.MONEY;
			},
		},
		pickupAddress: {
			street: String,
			city: String,
			state: String,
			zipCode: String,
			country: String,
		},
		dropoffAddress: {
			street: String,
			city: String,
			state: String,
			zipCode: String,
			country: String,
		},
		isPickup: {
			type: Boolean,
			required: true,
		},
		contactPhone: {
			type: String,
			required: true,
		},
		contactEmail: {
			type: String,
			required: true,
		},
		receiptImage: {
			type: String,
		},
		receiptImageMetadata: {
			originalName: String,
			mimeType: String,
			fileSize: Number,
			uploadedAt: Date,
			uploadedBy: {
				type: Schema.Types.ObjectId,
				ref: "User",
			},
		},
		pdfReceiptUrl: {
			type: String,
		},
		confirmationDate: {
			type: Date,
		},
		notes: {
			type: String,
		},
		paymentIntentId: {
			type: String,
			unique: true,
			sparse: true, // Allow null values but ensure uniqueness when present
		},
		paymentStatus: {
			type: String,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
DonationSchema.index({ donor: 1, status: 1 });
DonationSchema.index({ organization: 1, status: 1 });
DonationSchema.index({ type: 1, status: 1 });
DonationSchema.index({ scheduledDate: 1 });

export default mongoose.model<IDonation>("Donation", DonationSchema);
