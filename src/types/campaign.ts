import mongoose, { Schema, Document } from "mongoose";
import { DonationType } from "../models/donation.model";

export interface ICampaign extends Document {
	title: string;
	description: string;
	startDate: Date;
	endDate: Date;
	status: "draft" | "active" | "completed" | "cancelled";
	causes: mongoose.Types.ObjectId[];
	organizations: mongoose.Types.ObjectId[];
	totalTargetAmount: number;
	// totalRaisedAmount removed - calculated dynamically from donations
	// totalSupporters removed - calculated dynamically from donations
	imageUrl: string;
	tags: string[];
	acceptedDonationTypes: DonationType[];
	createdAt: Date;
	updatedAt: Date;
}
