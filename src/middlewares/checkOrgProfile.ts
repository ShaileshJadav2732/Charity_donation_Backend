import { Request, Response, NextFunction } from "express";
import { Organization } from "../models/Organization.model";
import { IUser } from "../types";

export const checkOrganizationProfileCompleted = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = req.user as IUser;

		if (user.role !== "organization") {
			return res
				.status(403)
				.json({ message: "Access denied: Not an organization" });
		}

		const organization = await Organization.findOne({ user: user.id });

		if (!organization || !organization.isProfileCompleted) {
			return res
				.status(403)
				.json({ message: "Organization profile not completed" });
		}

		// Attach org if needed: req.organization = organization;
		next();
	} catch (error) {
		console.error("Org profile check error:", error);
		res
			.status(500)
			.json({ message: "Server error while checking organization profile" });
	}
};
