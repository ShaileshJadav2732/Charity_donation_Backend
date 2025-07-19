import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { deleteFromCloudinary } from "../config/cloudinary.config";
import { IUser } from "../types";

// Extended Request interface with user property
interface AuthRequest extends Request {
	user?: IUser & { id: string };
	cloudinaryUrl?: string;
	cloudinaryPublicId?: string;
}

// Upload cause image to Cloudinary (image already uploaded by middleware)
export const uploadCauseImage = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		if (!req.cloudinaryUrl || !req.cloudinaryPublicId) {
			throw new AppError("Image upload failed - no Cloudinary URL found", 400);
		}

		res.status(200).json({
			success: true,
			message: "Cause image uploaded successfully",
			data: {
				url: req.cloudinaryUrl,
				publicId: req.cloudinaryPublicId,
			},
		});
	}
);

// Delete image from Cloudinary
export const deleteImage = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		const { publicId } = req.body;

		if (!publicId) {
			throw new AppError("Public ID is required", 400);
		}

		try {
			await deleteFromCloudinary(publicId);

			res.status(200).json({
				success: true,
				message: "Image deleted successfully",
			});
		} catch (error) {
			throw new AppError("Failed to delete image", 500);
		}
	}
);

export const uploadCampaignImage = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		if (!req.cloudinaryUrl || !req.cloudinaryPublicId) {
			throw new AppError("Image upload failed - no Cloudinary URL found", 400);
		}

		res.status(200).json({
			success: true,
			message: "Campaign image uploaded successfully",
			data: {
				url: req.cloudinaryUrl,
				publicId: req.cloudinaryPublicId,
			},
		});
	}
);

// Upload organization logo to Cloudinary (image already uploaded by middleware)
export const uploadOrganizationLogo = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		if (!req.cloudinaryUrl || !req.cloudinaryPublicId) {
			throw new AppError("Image upload failed - no Cloudinary URL found", 400);
		}

		// Import Organization model
		const Organization = require("../models/organization.model").default;

		// Find and update the organization's logo
		const organization = await Organization.findOne({ userId: req.user.id });

		if (!organization) {
			throw new AppError("Organization profile not found", 404);
		}

		// Update the logo field
		organization.logo = req.cloudinaryUrl;
		await organization.save();

		res.status(200).json({
			success: true,
			message: "Organization logo uploaded and saved successfully",
			data: {
				url: req.cloudinaryUrl,
				publicId: req.cloudinaryPublicId,
			},
		});
	}
);
