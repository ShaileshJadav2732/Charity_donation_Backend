import { Request } from "express";
import { Document } from "mongoose";

export interface IUser extends Document {
	_id: string;
	name: string;
	email: string;
	password: string;
	role: "donor" | "organization" | "admin";
	phone?: string;
	address?: string;
	createdAt: Date;
	updatedAt: Date;
	profileCompleted: boolean;
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

export interface AuthUser {
	_id: any;
	id: string;
	email: string;
	role: "donor" | "organization" | "admin";
}

export interface AuthRequest extends Request {
	user?: AuthUser;
}

// Core donation enums - single source of truth for backend
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

export enum DonationStatus {
	PENDING = "PENDING",
	APPROVED = "APPROVED",
	RECEIVED = "RECEIVED",
	CONFIRMED = "CONFIRMED",
	CANCELLED = "CANCELLED",
}

// Core address interface
export interface Address {
	street: string;
	city: string;
	state: string;
	zipCode: string;
	country: string;
}
