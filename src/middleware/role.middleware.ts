import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

// Middleware to check if user has required role
export const authorize = (roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: "Authentication required" });
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				message: "Not authorized to perform this action",
			});
		}

		next();
	};
};

// Middleware specifically for donor role
export const isDonor = (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	if (!req.user) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	if (req.user.role !== "donor") {
		return res
			.status(403)
			.json({ message: "Access denied. Donor role required." });
	}

	next();
};

// Middleware specifically for organization role
export const isOrganization = (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	if (!req.user) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	if (req.user.role !== "organization") {
		return res
			.status(403)
			.json({ message: "Access denied. Organization role required." });
	}

	next();
};

// Middleware specifically for admin role
export const isAdmin = (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	if (!req.user) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	if (req.user.role !== "admin") {
		return res
			.status(403)
			.json({ message: "Access denied. Admin role required." });
	}

	next();
};
