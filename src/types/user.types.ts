export type UserRole = "donor" | "organization" | "admin";

export interface IUser {
	id: string;
	name: string;
	email: string;
	password: string;
	role: UserRole;
	createdAt: Date;
	updatedAt: Date;
}
