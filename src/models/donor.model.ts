import { Schema, model, Document, Types } from "mongoose";

export interface IDonor extends Document {
	user: Types.ObjectId;
	fullAddress: string;
	phone: string;
	profilePhoto?: string;
	donationPreferences: string[];
	availability: string;
	isProfileCompleted: boolean;
}

const donorSchema = new Schema<IDonor>({
	user: { type: Schema.Types.ObjectId, ref: "User", required: true },
	fullAddress: { type: String, required: true },
	phone: { type: String, required: true },
	profilePhoto: String,
	donationPreferences: [{ type: String, required: true }],
	availability: { type: String, required: true },
	isProfileCompleted: { type: Boolean, default: false },
});

export default model<IDonor>("Donor", donorSchema);
