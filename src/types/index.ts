import { Request } from "express";
import { IUser } from "../models/user.model";

export interface AuthRequest extends Request {
	user?: IUser & { id: string };
	file?: Express.Multer.File;
}

export interface IUser {
	_id: string;
	name: string;
	email: string;
	password: string;
	role: "DONOR" | "ORGANIZATION" | "ADMIN";
	organization?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface IDonorProfile {
	userId: string;
	firstName: string;
	lastName: string;
	phoneNumber?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	profileImage?: string;
	bio?: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IOrganizationProfile {
	userId: string;
	name: string;
	description: string;
	phoneNumber: string;
	email: string;
	website?: string;
	address?: string;
	city?: string;
	state?: string;
	country?: string;
	logo?: string;
	documents?: string[];
	verified: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}
