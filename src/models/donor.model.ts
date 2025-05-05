import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./user.model";

export interface IDonor extends Document {
	user: IUser["_id"];
	profilePhoto: string;
	fullAddress: string;
	phone: string;
	donationPreferences: string[];
	availability: string;
	isProfileCompleted: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const donorSchema = new Schema<IDonor>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		profilePhoto: {
			type: String,
			default: "",
		},
		fullAddress: {
			type: String,
			default: "",
		},
		phone: {
			type: String,
			default: "",
		},
		donationPreferences: {
			type: [String],
			default: [],
		},
		availability: {
			type: String,
			default: "",
		},
		isProfileCompleted: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

const Donor = mongoose.model<IDonor>("Donor", donorSchema);

export default Donor;
