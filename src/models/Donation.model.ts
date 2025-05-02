import mongoose, { Document, Schema } from "mongoose";

export interface IDonation extends Document {
	donor: mongoose.Types.ObjectId;
	organization: mongoose.Types.ObjectId;
	type: "clothes" | "food" | "blood" | "books" | "money";
	quantity: string;
	otherQuantityDetails?: string;
	pickupAddress: string;
	preferredTime: string;
	status: "pending" | "accepted" | "completed";
	createdAt: Date;
}

const DonationSchema = new Schema<IDonation>(
	{
		donor: { type: Schema.Types.ObjectId, ref: "Donor", required: true },
		organization: {
			type: Schema.Types.ObjectId,
			ref: "Organization",
			required: true,
		},
		type: {
			type: String,
			enum: ["clothes", "food", "blood", "books", "money"],
			required: true,
		},
		quantity: { type: String, required: true },
		otherQuantityDetails: { type: String, default: "" },
		pickupAddress: { type: String, required: true },
		preferredTime: { type: String, required: true },
		status: {
			type: String,
			enum: ["pending", "accepted", "completed"],
			default: "pending",
		},
	},
	{ timestamps: true }
);

export const Donation = mongoose.model<IDonation>("Donation", DonationSchema);
