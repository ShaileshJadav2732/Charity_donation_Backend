import { Request, Response, NextFunction } from "express";
import admin from "../config/firebase";
import User from "../models/user.model";

export interface AuthRequest extends Request {
	user: {
		_id: string;
		email: string;
		role: string;
		displayName?: string;
		photoURL?: string;
	};
}

// Authentication middleware
export const auth = async (req: Request, res: Response, next: NextFunction) => {
	try {
		// Get token from header
		const token = req.headers.authorization?.split("Bearer ")[1];

		if (!token) {
			return res
				.status(401)
				.json({ message: "No token, authorization denied" });
		}

		// Verify token
		const decodedToken = await admin.auth().verifyIdToken(token);
		const { uid, email } = decodedToken;

		if (!email) {
			return res.status(401).json({ message: "Invalid token" });
		}

		// Get user from database
		const user = await User.findOne({ firebaseUid: uid });

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		// Set user in request
		(req as AuthRequest).user = {
			_id: user._id.toString(),
			email: user.email,
			role: user.role,
			displayName: user.displayName,
			photoURL: user.photoURL,
		};

		next();
	} catch (error) {
		console.error("Auth middleware error:", error);
		return res.status(401).json({ message: "Token is not valid" });
	}
};

// Authorization middleware
export const authorize = (roles: string | string[]) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const authReq = req as AuthRequest;

		if (!authReq.user) {
			return res.status(401).json({ message: "Not authenticated" });
		}

		const rolesArray = typeof roles === "string" ? [roles] : roles;

		if (rolesArray.includes(authReq.user.role)) {
			next();
		} else {
			return res.status(403).json({
				message: "Not authorized to access this resource",
			});
		}
	};
};
