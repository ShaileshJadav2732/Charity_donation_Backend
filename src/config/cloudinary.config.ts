import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validate configuration
if (
	!process.env.CLOUDINARY_CLOUD_NAME ||
	!process.env.CLOUDINARY_API_KEY ||
	!process.env.CLOUDINARY_API_SECRET
) {
}

export default cloudinary;

// Helper function to upload image to Cloudinary
export const uploadToCloudinary = async (
	file: Express.Multer.File,
	folder: string = "causes"
): Promise<{ url: string; public_id: string }> => {
	try {
		const result = await cloudinary.uploader.upload(file.path, {
			folder: `charity-donation/${folder}`,
			resource_type: "image",
			transformation: [
				{ width: 800, height: 600, crop: "fill", quality: "auto" },
				{ fetch_format: "auto" },
			],
		});

		// Clean up temporary file
		const fs = require("fs");
		if (fs.existsSync(file.path)) {
			fs.unlinkSync(file.path);
		}

		return {
			url: result.secure_url,
			public_id: result.public_id,
		};
	} catch (error) {
		// Clean up temporary file even on error
		const fs = require("fs");
		if (file.path && fs.existsSync(file.path)) {
			fs.unlinkSync(file.path);
		}
		throw new Error("Failed to upload image to Cloudinary");
	}
};

// Helper function to delete image from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
	try {
		await cloudinary.uploader.destroy(publicId);
	} catch (error) {
		throw new Error("Failed to delete image from Cloudinary");
	}
};
