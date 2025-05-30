import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import {
	uploadToCloudinary,
	deleteFromCloudinary,
} from "../config/cloudinary.config";
import { IUser } from "../types";

// Extended Request interface with user property
interface AuthRequest extends Request {
	user?: IUser & { id: string };
}

// Upload cause image to Cloudinary
export const uploadCauseImage = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		if (!req.file) {
			throw new AppError("No image file provided", 400);
		}

		try {
			const result = await uploadToCloudinary(req.file, "causes");

			res.status(200).json({
				success: true,
				message: "Image uploaded successfully",
				data: {
					url: result.url,
					publicId: result.public_id,
				},
			});
		} catch (error) {
			throw new AppError("Failed to upload image", 500);
		}
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

// Upload campaign image to Cloudinary
export const uploadCampaignImage = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		if (!req.file) {
			throw new AppError("No image file provided", 400);
		}

		try {
			const result = await uploadToCloudinary(req.file, "campaigns");

			res.status(200).json({
				success: true,
				message: "Campaign image uploaded successfully",
				data: {
					url: result.url,
					publicId: result.public_id,
				},
			});
		} catch (error) {
			throw new AppError("Failed to upload campaign image", 500);
		}
	}
);

// Upload organization logo to Cloudinary
export const uploadOrganizationLogo = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		if (!req.file) {
			throw new AppError("No image file provided", 400);
		}

		try {
			const result = await uploadToCloudinary(req.file, "organizations");

			res.status(200).json({
				success: true,
				message: "Organization logo uploaded successfully",
				data: {
					url: result.url,
					publicId: result.public_id,
				},
			});
		} catch (error) {
			throw new AppError("Failed to upload organization logo", 500);
		}
	}
);
