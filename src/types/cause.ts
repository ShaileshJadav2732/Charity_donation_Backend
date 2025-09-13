import { DonationType } from "./index";
import mongoose from "mongoose";
export interface Cause {
	id: string;
	title: string;
	description: string;
	targetAmount: number;
	// raisedAmount removed - calculated dynamically from donations
	imageUrl: string;
	tags: string[];
	category?: string;
	status?: "active" | "completed" | "draft";
	organizationId: string;
	organizationName?: string;
	createdAt: string;
	updatedAt: string;
}

export interface CauseResponse {
	success: boolean;
	cause: Cause;
}

export interface CausesResponse {
	success: boolean;
	causes: Cause[];
	total: number;
	page: number;
	limit: number;
}

export interface CauseQueryParams {
	page?: number;
	limit?: number;
	search?: string;
	tag?: string;
	sort?: string;
}

export interface CreateCauseBody {
	title: string;
	description: string;
	targetAmount: number;
	imageUrl: string;
	tags?: string[];
	category?: string;
	status?: "active" | "completed" | "draft";
}

export interface UpdateCauseBody {
	title?: string;
	description?: string;
	targetAmount?: number;
	imageUrl?: string;
	tags?: string[];
	category?: string;
	status?: "active" | "completed" | "draft";
}

export interface ICause extends Document {
	title: string;
	description: string;
	targetAmount: number;
	raisedAmount?: number; // Optional field for tracking raised amount
	imageUrl: string;
	tags: string[];
	organizationId: mongoose.Types.ObjectId;
	acceptanceType: "money" | "items" | "both";
	donationItems: string[];
	acceptedDonationTypes: DonationType[];
	createdAt: Date;
	updatedAt: Date;
}
