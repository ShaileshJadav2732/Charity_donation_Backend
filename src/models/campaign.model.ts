// backend/models/campaign.model.ts
import mongoose, { Schema, Document } from "mongoose";
import { DonationType } from "./donation.model";

export interface ICampaign extends Document {
	title: string;
	description: string;
	startDate: Date;
	endDate: Date;
	status: "draft" | "active" | "completed" | "cancelled";
	causes: mongoose.Types.ObjectId[];
	organizations: mongoose.Types.ObjectId[];
	totalTargetAmount: number;
	totalRaisedAmount: number;
	totalSupporters: number;
	imageUrl: string;
	tags: string[];
	acceptedDonationTypes: DonationType[];
	createdAt: Date;
	updatedAt: Date;
}

const CampaignSchema: Schema = new Schema(
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
		startDate: {
			type: Date,
			required: [true, "Start date is required"],
		},
		endDate: {
			type: Date,
			required: [true, "End date is required"],
		},
		status: {
			type: String,
			enum: ["draft", "active", "completed", "cancelled"],
			default: "draft",
		},
		causes: [
			{
				type: Schema.Types.ObjectId,
				ref: "Cause",
			},
		],
		organizations: [
			{
				type: Schema.Types.ObjectId,
				ref: "Organization",
				required: [true, "At least one organization is required"],
			},
		],
		totalTargetAmount: {
			type: Number,
			required: [true, "Target amount is required"],
			min: [0, "Target amount cannot be negative"],
		},
		totalRaisedAmount: {
			type: Number,
			default: 0,
			min: [0, "Raised amount cannot be negative"],
		},
		totalSupporters: {
			type: Number,
			default: 0,
			min: [0, "Supporters count cannot be negative"],
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
		acceptedDonationTypes: {
			type: [
				{
					type: String,
					enum: Object.values(DonationType),
				},
			],
			required: [true, "At least one donation type is required"],
			default: [DonationType.MONEY],
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
CampaignSchema.index({ title: "text", description: "text" });
CampaignSchema.index({ status: 1 });
CampaignSchema.index({ organizations: 1 });
CampaignSchema.index({ tags: 1 });
CampaignSchema.index({ createdAt: -1 });

export default mongoose.model<ICampaign>("Campaign", CampaignSchema);
