import mongoose, { Document, Schema } from "mongoose";

export interface IOrganization extends Document {
	user: mongoose.Types.ObjectId;
	orgName: string;
	profilePhoto: string;
	fullAddress: string;
	phone: string;
	missionStatement: string;
	acceptedDonationTypes: string[];
	isProfileCompleted: boolean;
}

const OrganizationSchema = new Schema<IOrganization>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			unique: true,
		},
		orgName: {
			type: String,
			required: true,
		},
		profilePhoto: {
			type: String,
			required: true,
		},
		fullAddress: {
			type: String,
			required: true,
		},
		phone: {
			type: String,
			required: true,
		},
		missionStatement: {
			type: String,
			required: true,
		},
		acceptedDonationTypes: {
			type: [String],
			required: true,
		},
		isProfileCompleted: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

export const Organization = mongoose.model<IOrganization>(
	"Organization",
	OrganizationSchema
);
