import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
	username: string;
	password?: string; // Make optional since Firebase will handle auth
	email: string; // Add email for Firebase users
	firebaseUid: string; // Store Firebase UID
	displayName?: string;
	photoURL?: string;
	role: "admin" | "organization" | "donor";
}

export const roles = ["donor", "organization", "admin"] as const;
export type UserRole = (typeof roles)[number];

const userSchema = new Schema<IUser>(
	{
		username: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		password: {
			type: String,
			required: false, // No longer required with Firebase
		},
		email: {
			type: String,
			required: true,
			unique: true,
		},
		firebaseUid: {
			type: String,
			required: true,
			unique: true,
		},
		displayName: {
			type: String,
		},
		photoURL: {
			type: String,
		},
		role: { type: String, enum: roles, required: true },
	},
	{
		timestamps: true,
	}
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
