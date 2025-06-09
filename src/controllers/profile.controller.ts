import { Response } from "express";
import User from "../models/user.model";
import DonorProfile from "../models/donor.model";
import Organization from "../models/organization.model";
import { AuthRequest } from "../types";

// Complete donor profile
export const completeDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const {
			firstName,
			lastName,
			phoneNumber,
			address,
			city,
			state,
			country,
			bio,
			profileImage,
		} = req.body;

		// Validate required fields
		if (!firstName || !lastName) {
			return res
				.status(400)
				.json({ message: "First name and last name are required" });
		}

		// Check if user exists and has donor role
		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if (user.role !== "donor") {
			return res
				.status(403)
				.json({ message: "Only donors can complete this profile" });
		}

		// Check if profile already exists
		let donorProfile = await DonorProfile.findOne({ userId: req.user.id });

		if (donorProfile) {
			// Update existing profile
			donorProfile.firstName = firstName;
			donorProfile.lastName = lastName;
			donorProfile.phoneNumber = phoneNumber;
			donorProfile.address = address;
			donorProfile.city = city;
			donorProfile.state = state;
			donorProfile.country = country;
			donorProfile.bio = bio;
			if (profileImage !== undefined) {
				donorProfile.profileImage = profileImage;
			}
		} else {
			// Create new profile
			donorProfile = new DonorProfile({
				userId: req.user.id,
				firstName,
				lastName,
				phoneNumber,
				address,
				city,
				state,
				country,
				bio,
				profileImage,
			});
		}

		await donorProfile.save();

		// Update user's profileCompleted status
		user.profileCompleted = true;
		await user.save();

		return res.status(200).json({
			message: "Donor profile completed successfully",
			profile: donorProfile,
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

// Complete organization profile
export const completeOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const {
			name,
			description,
			phoneNumber,
			email,
			website,
			address,
			city,
			state,
			country,
		} = req.body;

		// Validate required fields
		if (!name || !description || !phoneNumber || !email) {
			return res.status(400).json({
				message: "Name, description, phone number, and email are required",
			});
		}

		// Check if user exists and has organization role
		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if (user.role !== "organization") {
			return res
				.status(403)
				.json({ message: "Only organizations can complete this profile" });
		}

		// Check if profile already exists
		let orgProfile = await Organization.findOne({ userId: req.user.id });

		if (orgProfile) {
			// Update existing profile
			orgProfile.name = name;
			orgProfile.description = description;
			orgProfile.phoneNumber = phoneNumber;
			orgProfile.email = email;
			orgProfile.website = website;
			orgProfile.address = address;
			orgProfile.city = city;
			orgProfile.state = state;
			orgProfile.country = country;
		} else {
			// Create new profile
			orgProfile = new Organization({
				userId: req.user.id,
				name,
				description,
				phoneNumber,
				email,
				website,
				address,
				city,
				state,
				country,
				verified: false,
			});
		}

		await orgProfile.save();

		// Update user's profileCompleted status
		user.profileCompleted = true;
		await user.save();

		return res.status(200).json({
			message: "Organization profile completed successfully",
			profile: orgProfile,
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

// Get donor profile
export const getDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const donorProfile = await DonorProfile.findOne({ userId: req.user.id });

		if (!donorProfile) {
			return res.status(404).json({ message: "Donor profile not found" });
		}

		return res.status(200).json({ profile: donorProfile });
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

// Get organization profile
export const getOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const orgProfile = await Organization.findOne({
			userId: req.user.id,
		});

		if (!orgProfile) {
			return res
				.status(404)
				.json({ message: "Organization profile not found" });
		}

		return res.status(200).json({ profile: orgProfile });
	} catch (error) {
		return res
			.status(500)
			.json({ message: "Server error", error: error.message });
	}
};

// Update donor profile
export const updateDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		// Check if user exists and has donor role
		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if (user.role !== "donor") {
			return res
				.status(403)
				.json({ message: "Only donors can update this profile" });
		}

		// Find donor profile
		const donorProfile = await DonorProfile.findOne({ userId: req.user.id });
		if (!donorProfile) {
			return res.status(404).json({ message: "Donor profile not found" });
		}

		// Update profile fields that are provided (only allowed fields)
		const {
			firstName,
			lastName,
			phoneNumber,
			address,
			city,
			state,
			country,
			bio,
			profileImage,
		} = req.body;

		// Update only the fields that are provided and valid
		if (firstName !== undefined) donorProfile.firstName = firstName;
		if (lastName !== undefined) donorProfile.lastName = lastName;
		if (phoneNumber !== undefined) donorProfile.phoneNumber = phoneNumber;
		if (address !== undefined) donorProfile.address = address;
		if (city !== undefined) donorProfile.city = city;
		if (state !== undefined) donorProfile.state = state;
		if (country !== undefined) donorProfile.country = country;
		if (bio !== undefined) donorProfile.bio = bio;
		if (profileImage !== undefined) donorProfile.profileImage = profileImage;

		await donorProfile.save();

		return res.status(200).json({
			message: "Profile updated successfully",
			profile: donorProfile,
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

// Update organization profile
export const updateOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		// Check if user exists and has organization role
		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if (user.role !== "organization") {
			return res
				.status(403)
				.json({ message: "Only organizations can update this profile" });
		}

		// Find organization profile
		const orgProfile = await Organization.findOne({
			userId: req.user.id,
		});
		if (!orgProfile) {
			return res
				.status(404)
				.json({ message: "Organization profile not found" });
		}

		// Update profile fields that are provided (only allowed fields)
		const {
			name,
			description,
			phoneNumber,
			email,
			website,
			address,
			city,
			state,
			country,
			logo,
		} = req.body;

		// Update only the fields that are provided and valid
		if (name !== undefined) orgProfile.name = name;
		if (description !== undefined) orgProfile.description = description;
		if (phoneNumber !== undefined) orgProfile.phoneNumber = phoneNumber;
		if (email !== undefined) orgProfile.email = email;
		if (website !== undefined) orgProfile.website = website;
		if (address !== undefined) orgProfile.address = address;
		if (city !== undefined) orgProfile.city = city;
		if (state !== undefined) orgProfile.state = state;
		if (country !== undefined) orgProfile.country = country;
		if (logo !== undefined) orgProfile.logo = logo;

		await orgProfile.save();

		return res.status(200).json({
			message: "Profile updated successfully",
			profile: orgProfile,
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};

// Upload donor profile image
export const uploadDonorProfileImage = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		if (!req.cloudinaryUrl) {
			return res
				.status(400)
				.json({ message: "No image uploaded to cloud storage" });
		}

		// Check if user exists and has donor role
		const user = await User.findById(req.user.id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		if (user.role !== "donor") {
			return res
				.status(403)
				.json({ message: "Only donors can upload profile images" });
		}

		// Find donor profile
		const donorProfile = await DonorProfile.findOne({ userId: req.user.id });
		if (!donorProfile) {
			return res.status(404).json({ message: "Donor profile not found" });
		}

		// Update profile with Cloudinary URL
		donorProfile.profileImage = req.cloudinaryUrl;
		donorProfile.cloudinaryPublicId = req.cloudinaryPublicId; // Store for future deletion if needed
		await donorProfile.save();

		return res.status(200).json({
			success: true,
			message: "Profile image uploaded successfully",
			profileImage: req.cloudinaryUrl,
		});
	} catch (error) {
		return res.status(500).json({ message: "Server error" });
	}
};
