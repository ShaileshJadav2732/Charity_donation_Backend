// models/Donor.model.ts
import mongoose from "mongoose";

const donorSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			unique: true,
		},
		profilePhoto: {
			type: String, // URL or base64 path
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
		donationPreferences: {
			type: [String], // Example: ["clothes", "books"]
			default: [],
		},
		availability: {
			type: new mongoose.Schema(
				{
					days: {
						type: [String],
						required: true,
					},
					time: {
						type: String,
						required: true,
					},
				},
				{ _id: false }
			),
			required: true,
		},

		isProfileCompleted: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

export const Donor = mongoose.model("Donor", donorSchema);
