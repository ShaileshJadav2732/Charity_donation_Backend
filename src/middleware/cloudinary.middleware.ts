import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { v2 as cloudinary } from "cloudinary";

// Extended Request interface for Cloudinary URLs
declare global {
	namespace Express {
		interface Request {
			cloudinaryUrl?: string;
			cloudinaryPublicId?: string;
		}
	}
}

// Configure Cloudinary (make sure you have these env variables)
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to upload buffer to Cloudinary
const uploadBufferToCloudinary = async (
	buffer: Buffer,
	folder: string,
	transformations?: any
): Promise<any> => {
	return new Promise((resolve, reject) => {
		const uploadOptions: any = {
			folder,
			resource_type: "auto",
		};

		if (transformations) {
			uploadOptions.transformation = transformations;
		}

		const uploadStream = cloudinary.uploader.upload_stream(
			uploadOptions,
			(error, result) => {
				if (error) {
					console.error("Cloudinary upload error:", error);
					reject(error);
				} else {
					resolve(result);
				}
			}
		);

		uploadStream.end(buffer);
	});
};

// File filter for images only
const imageFileFilter = (
	req: any,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	if (file.mimetype.startsWith("image/")) {
		cb(null, true);
	} else {
		cb(new Error("Only image files are allowed!"));
	}
};

// File filter for receipts (allows images and PDFs)
const receiptFileFilter = (
	req: any,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const allowedMimeTypes = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"application/pdf",
		"image/bmp",
		"image/tiff",
	];

	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				"Only image files (JPEG, PNG, GIF, WebP, BMP, TIFF) and PDF files are allowed for receipts!"
			)
		);
	}
};

// Generic Cloudinary upload middleware
const createCloudinaryUploadMiddleware = (
	fieldName: string,
	folder: string,
	fileFilter: any,
	transformations?: any
) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			console.log(`📤 ${folder} upload middleware called`);

			// Improved content-type check
			const contentType = req.headers["content-type"];
			if (
				!contentType ||
				!contentType.toLowerCase().includes("multipart/form-data")
			) {
				return res.status(400).json({
					success: false,
					message: "Request must be multipart/form-data",
				});
			}

			// Use multer to handle the file upload to memory
			const upload = multer({
				storage: multer.memoryStorage(),
				limits: {
					fileSize: 5 * 1024 * 1024, // 5MB limit
					files: 1, // Only one file
				},
				fileFilter: fileFilter,
			}).single(fieldName);

			upload(req, res, async (err) => {
				if (err) {
					console.error(`❌ Multer error in ${folder} upload:`, err);

					// Handle specific multer errors
					if (err instanceof multer.MulterError) {
						if (err.code === "LIMIT_FILE_SIZE") {
							return res.status(400).json({
								success: false,
								message: "File size too large. Maximum size is 5MB.",
							});
						}
						if (err.code === "LIMIT_FILE_COUNT") {
							return res.status(400).json({
								success: false,
								message: "Too many files. Only one file allowed.",
							});
						}
						if (err.code === "LIMIT_UNEXPECTED_FILE") {
							return res.status(400).json({
								success: false,
								message: `Unexpected field name. Expected: ${fieldName}`,
							});
						}
					}

					return res.status(400).json({
						success: false,
						message: err.message || "File upload error",
					});
				}

				if (!req.file) {
					return res.status(400).json({
						success: false,
						message: `No ${fieldName} file uploaded`,
					});
				}

				// Validate file buffer
				if (!req.file.buffer || req.file.buffer.length === 0) {
					return res.status(400).json({
						success: false,
						message: "Invalid file: empty buffer",
					});
				}

				try {
					console.log(`📤 Uploading ${folder} to Cloudinary...`);
					console.log(`📊 File info:`, {
						fieldName,
						originalName: req.file.originalname,
						mimeType: req.file.mimetype,
						size: req.file.size,
						bufferLength: req.file.buffer.length,
					});

					// Upload to Cloudinary
					const result = await uploadBufferToCloudinary(
						req.file.buffer,
						folder,
						transformations
					);

					console.log(`✅ ${folder} uploaded to Cloudinary:`, {
						url: result.secure_url,
						publicId: result.public_id,
						format: result.format,
						width: result.width,
						height: result.height,
					});

					// Add Cloudinary URL to request for controller to use
					req.cloudinaryUrl = result.secure_url;
					req.cloudinaryPublicId = result.public_id;

					next();
				} catch (uploadError) {
					console.error(
						`❌ Cloudinary upload error for ${folder}:`,
						uploadError
					);
					return res.status(500).json({
						success: false,
						message: `Failed to upload ${folder} to cloud storage`,
						error:
							process.env.NODE_ENV === "development" ? uploadError : undefined,
					});
				}
			});
		} catch (error) {
			console.error(`❌ ${folder} upload middleware error:`, error);
			return res.status(500).json({
				success: false,
				message: "Internal server error during file upload",
				error: process.env.NODE_ENV === "development" ? error : undefined,
			});
		}
	};
};

// Specific middleware for different upload types
export const uploadProfilePhotoToCloudinary = createCloudinaryUploadMiddleware(
	"profileImage",
	"profile-photos",
	imageFileFilter,
	{
		width: 400,
		height: 400,
		crop: "fill",
		gravity: "face",
		quality: "auto",
		format: "jpg",
	}
);

export const uploadCauseImageToCloudinary = createCloudinaryUploadMiddleware(
	"image",
	"causes",
	imageFileFilter,
	{
		width: 800,
		height: 600,
		crop: "fill",
		quality: "auto",
		format: "auto",
	}
);

export const uploadCampaignImageToCloudinary = createCloudinaryUploadMiddleware(
	"image",
	"campaigns",
	imageFileFilter,
	{
		width: 800,
		height: 600,
		crop: "fill",
		quality: "auto",
		format: "auto",
	}
);

export const uploadOrganizationLogoToCloudinary =
	createCloudinaryUploadMiddleware("image", "organizations", imageFileFilter, {
		width: 400,
		height: 400,
		crop: "fill",
		quality: "auto",
		format: "auto",
	});

export const uploadDonationPhotoToCloudinary = createCloudinaryUploadMiddleware(
	"photo",
	"donation-photos",
	imageFileFilter,
	{
		width: 800,
		height: 600,
		crop: "fill",
		quality: "auto",
		format: "auto",
	}
);

export const uploadReceiptToCloudinary = createCloudinaryUploadMiddleware(
	"receipt",
	"receipts",
	receiptFileFilter,
	{
		quality: "auto",
		format: "auto",
	}
);

// Export the upload function for other uses
export { uploadBufferToCloudinary };
