import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
	username: string;
	password: string;
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
			required: true,
		},
		role: { type: String, enum: roles, required: true },
	},
	{
		timestamps: true,
	}
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
