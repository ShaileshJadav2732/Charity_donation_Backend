import mongoose, { Schema, Document } from "mongoose";

export interface IOrganization extends Document {
	name: string;
	description: string;
	phoneNumber: string;
	email: string;
	website?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	logo?: string;
	documents?: string[];
	verified: boolean;
	userId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const OrganizationSchema: Schema = new Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
		},
		description: {
			type: String,
			required: [true, "Description is required"],
			trim: true,
		},
		phoneNumber: {
			type: String,
			required: [true, "Phone number is required"],
			trim: true,
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			trim: true,
			lowercase: true,
			match: [
				/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
				"Please provide a valid email address",
			],
		},
		website: {
			type: String,
			trim: true,
		},
		address: {
			type: String,
			trim: true,
		},
		city: {
			type: String,
			trim: true,
		},
		state: {
			type: String,
			trim: true,
		},
		country: {
			type: String,
			trim: true,
		},
		logo: {
			type: String,
		},
		documents: [
			{
				type: String,
			},
		],
		verified: {
			type: Boolean,
			default: false,
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: [true, "User ID is required"],
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better query performance
OrganizationSchema.index({ name: "text", description: "text" });
OrganizationSchema.index({ userId: 1 });
OrganizationSchema.index({ createdAt: -1 });

export default mongoose.model<IOrganization>(
	"Organization",
	OrganizationSchema
);
