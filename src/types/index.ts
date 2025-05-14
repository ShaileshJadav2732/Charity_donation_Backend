import { Request } from "express";
import { Document } from "mongoose";

export interface IUser extends Document {
	_id: string;
	name: string;
	email: string;
	password: string;
	role: "user" | "organization" | "admin";
	phone?: string;
	address?: string;
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

export interface AuthRequest extends Request {
	user?: IUser;
}

export enum DonationType {
	MONEY = "MONEY",
	CLOTHES = "CLOTHES",
	BLOOD = "BLOOD",
	FOOD = "FOOD",
	TOYS = "TOYS",
	BOOKS = "BOOKS",
	FURNITURE = "FURNITURE",
	HOUSEHOLD = "HOUSEHOLD",
	OTHER = "OTHER",
}
