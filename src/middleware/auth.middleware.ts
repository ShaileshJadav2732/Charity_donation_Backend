import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import admin from "../config/firebase.config";
import User from "../models/user.model";
import { AuthRequest, AuthUser } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

// Middleware to verify JWT token
export const authenticate = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;
		const token = authHeader?.split(" ")[1];

		if (!token) {
			return res.status(401).json({
				message: "No token provided",
				code: "NO_TOKEN",
			});
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
			id: string;
		};

		const user = await User.findById(decoded.id);

		if (!user) {
			return res.status(401).json({
				message: "User not found",
				code: "USER_NOT_FOUND",
			});
		}

		req.user = {
			_id: user._id,
			id: user._id.toString(),
			email: user.email,
			role: user.role,
		};
		next();
	} catch (error: any) {
		// Handle specific JWT errors
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				message: "Token expired",
				code: "TOKEN_EXPIRED",
				error: error.message,
			});
		}

		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({
				message: "Invalid token",
				code: "INVALID_TOKEN",
				error: error.message,
			});
		}

		res.status(401).json({
			message: "Authentication failed",
			code: "AUTH_FAILED",
			error: error?.message || "Unknown authentication error",
		});
	}
};

// Middleware to verify Firebase token
export const verifyFirebaseToken = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				message: "No token provided",
				code: "NO_TOKEN",
			});
		}

		const token = authHeader.split(" ")[1];

		const decodedToken = await admin.auth().verifyIdToken(token);

		// Find user in database
		const user = await User.findOne({ firebaseUid: decodedToken.uid });

		if (!user) {
			return res.status(404).json({
				message: "User not found",
				code: "USER_NOT_FOUND",
			});
		}

		req.user = {
			_id: user._id,
			id: user._id.toString(),
			email: user.email,
			role: user.role,
		};

		next();
	} catch (error: any) {
		// Handle specific Firebase errors
		if (error.code === "auth/id-token-expired") {
			return res.status(401).json({
				message: "Firebase token expired",
				code: "FIREBASE_TOKEN_EXPIRED",
			});
		}

		if (error.code === "auth/argument-error") {
			return res.status(401).json({
				message: "Invalid Firebase token format",
				code: "INVALID_FIREBASE_TOKEN",
			});
		}

		return res.status(401).json({
			message: "Invalid or expired Firebase token",
			code: "FIREBASE_AUTH_FAILED",
			error: error.message,
		});
	}
};
