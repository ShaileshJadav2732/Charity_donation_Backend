import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import admin from "../config/firebase.config";
import User from "../models/user.model";
import { AuthRequest, IUser } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

declare global {
	namespace Express {
		interface Request {
			user?: IUser;
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
		const token = req.headers.authorization?.split(" ")[1];

		if (!token) {
			return res.status(401).json({ message: "No token provided" });
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
			id: string;
		};
		const user = await User.findById(decoded.id);

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		req.user = user;
		next();
	} catch (error: any) {
		res.status(401).json({
			message: "Authentication failed",
			error: error?.message || "Invalid token",
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
			return res.status(401).json({ message: "No token provided" });
		}

		const token = authHeader.split(" ")[1];

		const decodedToken = await admin.auth().verifyIdToken(token);

		// Find user in database
		const user = await User.findOne({ firebaseUid: decodedToken.uid });

		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		req.user = {
			id: user._id.toString(),
			email: user.email,
			role: user.role,
		};

		next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};
