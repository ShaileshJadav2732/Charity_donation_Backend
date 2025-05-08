import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import Donor from "../models/donor.model";
import Organization from "../models/organization.model";

/**
 * Middleware to allow access to profile routes only if the user's profile is completed
 */
export const requireCompletedProfileAccess = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const { role, _id } = req.user;

		if (role === "donor") {
			const donor = await Donor.findOne({ user: _id });

			if (!donor) {
				return res.status(403).json({
					success: false,
					message: "Donor profile not found",
				});
			}

			if (!donor.isProfileCompleted) {
				return res.status(403).json({
					success: false,
					message: "Complete your donor profile to access this route",
					redirectTo: "/donor/complete-profile",
				});
			}
		} else if (role === "organization") {
			const organization = await Organization.findOne({ user: _id });

			if (!organization) {
				return res.status(403).json({
					success: false,
					message: "Organization profile not found",
				});
			}

			if (!organization.isProfileCompleted) {
				return res.status(403).json({
					success: false,
					message: "Complete your organization profile to access this route",
					redirectTo: "/organization/complete-profile",
				});
			}
		} else if (role !== "admin") {
			// Only donor, organization, and admin are valid roles
			return res.status(403).json({
				success: false,
				message: "Invalid user role",
			});
		}

		next();
	} catch (error) {
		console.error("Completed profile access error:", error);
		res.status(500).json({
			success: false,
			message: "Server error while checking profile access",
		});
	}
};
