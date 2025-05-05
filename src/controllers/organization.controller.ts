import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import Organization from "../models/organization.model";

// Get organization profile
export const getOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const organization = await Organization.findOne({
			user: req.user._id,
		}).populate("user", "username email displayName photoURL");

		if (!organization) {
			return res
				.status(404)
				.json({ message: "Organization profile not found" });
		}

		res.status(200).json(organization);
	} catch (error) {
		console.error("Get organization profile error:", error);
		res.status(500).json({ message: "Failed to fetch organization profile" });
	}
};

// Complete organization profile
export const completeOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const {
			orgName,
			profilePhoto,
			description,
			contactEmail,
			contactPhone,
			address,
			website,
			socialMedia,
			acceptedDonationTypes,
		} = req.body;

		// Validate required fields
		if (
			!orgName ||
			!description ||
			!contactEmail ||
			!contactPhone ||
			!address ||
			!acceptedDonationTypes
		) {
			return res.status(400).json({ message: "Required fields missing" });
		}

		// Find organization
		let organization = await Organization.findOne({ user: req.user._id });

		if (!organization) {
			// Create organization profile if not exists
			organization = await Organization.create({
				user: req.user._id,
				orgName,
				profilePhoto,
				description,
				contactEmail,
				contactPhone,
				address,
				website,
				socialMedia,
				acceptedDonationTypes,
				isProfileCompleted: true,
			});
		} else {
			// Update existing profile
			organization.orgName = orgName;
			organization.profilePhoto = profilePhoto;
			organization.description = description;
			organization.contactEmail = contactEmail;
			organization.contactPhone = contactPhone;
			organization.address = address;
			organization.website = website;
			organization.socialMedia = socialMedia;
			organization.acceptedDonationTypes = acceptedDonationTypes;
			organization.isProfileCompleted = true;
			await organization.save();
		}

		res.status(200).json({
			message: "Organization profile completed successfully",
			organization,
		});
	} catch (error) {
		console.error("Complete organization profile error:", error);
		res
			.status(500)
			.json({ message: "Failed to complete organization profile" });
	}
};

// Update organization profile
export const updateOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const updateData = req.body;

		// Find organization
		const organization = await Organization.findOne({ user: req.user._id });

		if (!organization) {
			return res
				.status(404)
				.json({ message: "Organization profile not found" });
		}

		// Update fields
		Object.keys(updateData).forEach((key) => {
			if (key !== "user" && key !== "_id" && key !== "isVerified") {
				(organization as any)[key] = updateData[key];
			}
		});

		await organization.save();

		res.status(200).json({
			message: "Organization profile updated successfully",
			organization,
		});
	} catch (error) {
		console.error("Update organization profile error:", error);
		res.status(500).json({ message: "Failed to update organization profile" });
	}
};

// List all organizations (public)
export const listOrganizations = async (req: AuthRequest, res: Response) => {
	try {
		const organizations = await Organization.find({ isProfileCompleted: true })
			.populate("user", "username email displayName")
			.select("-__v")
			.sort({ createdAt: -1 });

		res.status(200).json({
			message: "Organizations retrieved successfully",
			organizations,
		});
	} catch (error) {
		console.error("List organizations error:", error);
		res.status(500).json({ message: "Failed to retrieve organizations" });
	}
};

// Get organization by ID (public)
export const getOrganizationById = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		const organization = await Organization.findById(id).populate(
			"user",
			"username email displayName"
		);

		if (!organization) {
			return res.status(404).json({ message: "Organization not found" });
		}

		res.status(200).json({
			message: "Organization retrieved successfully",
			organization,
		});
	} catch (error) {
		console.error("Get organization by ID error:", error);
		res.status(500).json({ message: "Failed to retrieve organization" });
	}
};
