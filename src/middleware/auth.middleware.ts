import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

export interface AuthRequest extends Request {
	user?: any;
}

export const auth = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		// Get token from header
		const token = req.header("Authorization")?.replace("Bearer ", "");

		if (!token) {
			return res.status(401).json({ message: "Authentication required" });
		}

		// Verify token
		const decoded = jwt.verify(
			token,
			process.env.JWT_SECRET || "your-secret-key"
		) as any;

		// Find user
		const user = await User.findById(decoded.id);

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		// Add user to request object
		req.user = user;
		next();
	} catch (error) {
		console.error("Auth middleware error:", error);
		res.status(401).json({ message: "Authentication failed" });
	}
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: "Authentication required" });
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ message: "Access denied" });
		}

		next();
	};
};
