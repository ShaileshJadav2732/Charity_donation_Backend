import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./user.model";
import { IOrganization } from "./organization.model";

export interface IDonation extends Document {
	donor: IUser["_id"];
	organization: IOrganization["_id"];
	type: string;
	quantity: string;
	pickupAddress: string;
	preferredTime: string;
	status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

const donationSchema = new Schema<IDonation>(
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
		type: {
			type: String,
			required: true,
		},
		quantity: {
			type: String,
			required: true,
		},
		pickupAddress: {
			type: String,
			required: true,
		},
		preferredTime: {
			type: String,
			required: true,
		},
		status: {
			type: String,
			enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
			default: "pending",
		},
		notes: {
			type: String,
		},
	},
	{ timestamps: true }
);

const Donation = mongoose.model<IDonation>("Donation", donationSchema);

export default Donation;
