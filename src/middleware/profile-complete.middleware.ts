import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import Donor from "../models/donor.model";
import Organization from "../models/organization.model";

/**
 * Middleware to check if a user's profile is complete
 * Prevents users with incomplete profiles from accessing certain routes
 */
export const requireCompleteProfile = async (
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
					redirectTo: "/donor/complete-profile",
				});
			}

			if (!donor.isProfileCompleted) {
				return res.status(403).json({
					success: false,
					message: "Please complete your donor profile first",
					redirectTo: "/donor/complete-profile",
				});
			}
		} else if (role === "organization") {
			const organization = await Organization.findOne({ user: _id });

			if (!organization) {
				return res.status(403).json({
					success: false,
					message: "Organization profile not found",
					redirectTo: "/organization/complete-profile",
				});
			}

			if (!organization.isProfileCompleted) {
				return res.status(403).json({
					success: false,
					message: "Please complete your organization profile first",
					redirectTo: "/organization/complete-profile",
				});
			}
		} else if (role !== "admin") {
			// Only admin, donor, and organization roles are valid
			return res.status(403).json({
				success: false,
				message: "Invalid user role",
			});
		}

		// If we reach here, the profile is complete or user is admin (exempt from profile completion)
		next();
	} catch (error) {
		console.error("Profile completion check error:", error);
		res.status(500).json({
			success: false,
			message: "Server error during profile completion check",
		});
	}
};

/**
 * Middleware to bypass profile completion check for the user's own profile routes
 * Allows users to complete their own profiles even if the profile is incomplete
 */
export const allowOwnProfileAccess = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		// For routes that must be accessible even with incomplete profiles
		// Like profile completion routes, profile view routes, etc.

		const { path } = req;
		const { role } = req.user;

		// Allow access to profile completion endpoints regardless of profile status
		if (
			(role === "donor" && path.includes("/donors/complete-profile")) ||
			(role === "organization" &&
				path.includes("/organizations/complete-profile")) ||
			path.includes("/profile-status")
		) {
			return next();
		}

		// For other routes, check if profile is complete
		return requireCompleteProfile(req, res, next);
	} catch (error) {
		console.error("Profile access check error:", error);
		res.status(500).json({
			success: false,
			message: "Server error during profile access check",
		});
	}
};
