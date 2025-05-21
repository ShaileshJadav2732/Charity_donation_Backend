import mongoose, { Schema, Document } from "mongoose";
import { DonationType } from "./donation.model";

export interface ICause extends Document {
	title: string;
	description: string;
	targetAmount: number;
	raisedAmount: number;
	imageUrl: string;
	tags: string[];
	organizationId: mongoose.Types.ObjectId;
	acceptanceType: "money" | "items" | "both";
	donationItems: string[];
	acceptedDonationTypes: DonationType[];
	createdAt: Date;
	updatedAt: Date;
}

const CauseSchema: Schema = new Schema(
	{
		title: {
			type: String,
			required: [true, "Title is required"],
			trim: true,
		},
		description: {
			type: String,
			required: [true, "Description is required"],
			trim: true,
		},
		targetAmount: {
			type: Number,
			required: [true, "Target amount is required"],
			min: [0, "Target amount cannot be negative"],
		},
		raisedAmount: {
			type: Number,
			default: 0,
			min: [0, "Raised amount cannot be negative"],
		},
		imageUrl: {
			type: String,
			required: [true, "Image URL is required"],
		},
		tags: [
			{
				type: String,
				trim: true,
			},
		],
		organizationId: {
			type: Schema.Types.ObjectId,
			ref: "Organization",
			required: [true, "Organization is required"],
		},
		acceptanceType: {
			type: String,
			enum: ["money", "items", "both"],
			default: "money",
		},
		donationItems: [
			{
				type: String,
				trim: true,
			},
		],
		acceptedDonationTypes: [
			{
				type: String,
				enum: [
					"MONEY",
					"CLOTHES",
					"BLOOD",
					"FOOD",
					"TOYS",
					"BOOKS",
					"FURNITURE",
					"HOUSEHOLD",
					"OTHER",
				],
				default: ["MONEY"],
			},
		],
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
CauseSchema.index({ title: "text", description: "text" });
CauseSchema.index({ organizationId: 1 });
CauseSchema.index({ tags: 1 });
CauseSchema.index({ createdAt: -1 });

export default mongoose.model<ICause>("Cause", CauseSchema);
