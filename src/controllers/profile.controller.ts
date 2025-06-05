import { Response } from "express";
import User from "../models/user.model";
import DonorProfile from "../models/donor.model";
import OrganizationProfile from "../models/organization.model";
import { AuthRequest } from "../types";

// Helper functions
const checkAuth = (req: AuthRequest) => {
	if (!req.user) throw new Error("Unauthorized");
};

const validateUser = async (userId: string, expectedRole: string) => {
	const user = await User.findById(userId);
	if (!user) throw new Error("User not found");
	if (user.role !== expectedRole)
		throw new Error(`Only ${expectedRole}s can perform this action`);
	return user;
};

const updateFields = (target: any, source: any, fields: string[]) => {
	fields.forEach((field) => {
		if (source[field] !== undefined) target[field] = source[field];
	});
};

const handleError = (res: Response, error: any) => {
	const status =
		error.message === "Unauthorized"
			? 401
			: error.message === "User not found"
				? 404
				: error.message.includes("Only")
					? 403
					: 500;
	return res.status(status).json({ message: error.message || "Server error" });
};

export const completeDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		checkAuth(req);
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

		if (!firstName || !lastName) {
			return res
				.status(400)
				.json({ message: "First name and last name are required" });
		}

		await validateUser(req.user!.id, "donor");
		let donorProfile = await DonorProfile.findOne({ userId: req.user!.id });

		if (donorProfile) {
			updateFields(donorProfile, req.body, [
				"firstName",
				"lastName",
				"phoneNumber",
				"address",
				"city",
				"state",
				"country",
				"bio",
			]);
			if (profileImage !== undefined) donorProfile.profileImage = profileImage;
		} else {
			donorProfile = new DonorProfile({
				userId: req.user!.id,
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

		await Promise.all([
			donorProfile.save(),
			User.findByIdAndUpdate(req.user!.id, { profileCompleted: true }),
		]);

		return res.status(200).json({
			message: "Donor profile completed successfully",
			profile: donorProfile,
		});
	} catch (error: any) {
		return handleError(res, error);
	}
};

export const completeOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		checkAuth(req);
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

		if (!name || !description || !phoneNumber || !email) {
			return res.status(400).json({
				message: "Name, description, phone number, and email are required",
			});
		}

		await validateUser(req.user!.id, "organization");
		let orgProfile = await OrganizationProfile.findOne({
			userId: req.user!.id,
		});

		if (orgProfile) {
			updateFields(orgProfile, req.body, [
				"name",
				"description",
				"phoneNumber",
				"email",
				"website",
				"address",
				"city",
				"state",
				"country",
			]);
		} else {
			orgProfile = new OrganizationProfile({
				userId: req.user!.id,
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

		await Promise.all([
			orgProfile.save(),
			User.findByIdAndUpdate(req.user!.id, { profileCompleted: true }),
		]);

		return res.status(200).json({
			message: "Organization profile completed successfully",
			profile: orgProfile,
		});
	} catch (error: any) {
		return handleError(res, error);
	}
};

const getProfile = async (
	req: AuthRequest,
	res: Response,
	ProfileModel: any,
	profileType: string
) => {
	try {
		checkAuth(req);
		const profile = await ProfileModel.findOne({ userId: req.user!.id });
		if (!profile)
			return res
				.status(404)
				.json({ message: `${profileType} profile not found` });
		return res.status(200).json({ profile });
	} catch (error: any) {
		return handleError(res, error);
	}
};

export const getDonorProfile = async (req: AuthRequest, res: Response) =>
	getProfile(req, res, DonorProfile, "Donor");

export const getOrganizationProfile = async (req: AuthRequest, res: Response) =>
	getProfile(req, res, OrganizationProfile, "Organization");

const updateProfileHelper = async (
	req: AuthRequest,
	res: Response,
	ProfileModel: any,
	role: string,
	fields: string[]
) => {
	try {
		checkAuth(req);
		await validateUser(req.user!.id, role);

		const profile = await ProfileModel.findOne({ userId: req.user!.id });
		if (!profile)
			return res.status(404).json({ message: `${role} profile not found` });

		updateFields(profile, req.body, fields);
		await profile.save();

		return res
			.status(200)
			.json({ message: "Profile updated successfully", profile });
	} catch (error: any) {
		return handleError(res, error);
	}
};
export const updateDonorProfile = async (req: AuthRequest, res: Response) =>
	updateProfileHelper(req, res, DonorProfile, "donor", [
		"firstName",
		"lastName",
		"phoneNumber",
		"address",
		"city",
		"state",
		"country",
		"bio",
		"profileImage",
	]);

export const updateOrganizationProfile = async (
	req: AuthRequest,
	res: Response
) =>
	updateProfileHelper(req, res, OrganizationProfile, "organization", [
		"name",
		"description",
		"phoneNumber",
		"email",
		"website",
		"address",
		"city",
		"state",
		"country",
		"logo",
	]);

export const uploadDonorProfileImage = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		checkAuth(req);

		if (!req.cloudinaryUrl) {
			return res
				.status(400)
				.json({ message: "No image uploaded to cloud storage" });
		}

		await validateUser(req.user!.id, "donor");
		const donorProfile = await DonorProfile.findOne({ userId: req.user!.id });
		if (!donorProfile)
			return res.status(404).json({ message: "Donor profile not found" });

		donorProfile.profileImage = req.cloudinaryUrl;
		if (req.cloudinaryPublicId)
			(donorProfile as any).cloudinaryPublicId = req.cloudinaryPublicId;
		await donorProfile.save();

		return res.status(200).json({
			success: true,
			message: "Profile image uploaded successfully",
			profileImage: req.cloudinaryUrl,
		});
	} catch (error: any) {
		return handleError(res, error);
	}
};
