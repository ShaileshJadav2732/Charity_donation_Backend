import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./user.model";

export interface IOrganization extends Document {
	user: IUser["_id"];
	orgName: string;
	profilePhoto: string;
	description: string;
	contactEmail: string;
	contactPhone: string;
	address: string;
	website: string;
	socialMedia: {
		facebook?: string;
		twitter?: string;
		instagram?: string;
		linkedin?: string;
	};
	acceptedDonationTypes: string[];
	isVerified: boolean;
	isProfileCompleted: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		orgName: {
			type: String,
			required: true,
		},
		profilePhoto: {
			type: String,
			default: "",
		},
		description: {
			type: String,
			default: "",
		},
		contactEmail: {
			type: String,
			default: "",
		},
		contactPhone: {
			type: String,
			default: "",
		},
		address: {
			type: String,
			default: "",
		},
		website: {
			type: String,
			default: "",
		},
		socialMedia: {
			facebook: String,
			twitter: String,
			instagram: String,
			linkedin: String,
		},
		acceptedDonationTypes: {
			type: [String],
			default: [],
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		isProfileCompleted: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

const Organization = mongoose.model<IOrganization>(
	"Organization",
	organizationSchema
);

export default Organization;
