import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
	email: string;
	firebaseUid: string;
	role: "donor" | "organization" | "admin";
	displayName?: string;
	photoURL?: string;
	emailVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
	isProfileCompleted: boolean;
}

const userSchema = new Schema<IUser>(
	{
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
		},
		firebaseUid: {
			type: String,
			required: true,
			unique: true,
		},
		role: {
			type: String,
			enum: ["donor", "organization", "admin"],
			default: "donor",
		},
		displayName: {
			type: String,
			default: "",
		},
		photoURL: {
			type: String,
			default: "",
		},
		emailVerified: {
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

const User = mongoose.model<IUser>("User", userSchema);

export default User;
