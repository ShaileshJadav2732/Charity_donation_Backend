import multer from "multer";
import path from "path";
import fs from "fs-extra";
import { Request, Response, NextFunction } from "express";
import { uploadToCloudinary, uploadBufferToCloudinary } from "../config/cloudinary.config";

// Ensure upload directories exist
const donationPhotosDir = path.join(__dirname, "../../uploads/donation-photos");
const receiptsDir = path.join(__dirname, "../../uploads/receipts");
const profilePhotosDir = path.join(__dirname, "../../uploads/profile-photos");

// Create directories if they don't exist
try {
	// Use fs-extra to ensure directories exist (creates them if they don't)
	fs.ensureDirSync(donationPhotosDir);
	fs.ensureDirSync(receiptsDir);
	fs.ensureDirSync(profilePhotosDir);

	console.log(`Ensured directories exist:
		- ${donationPhotosDir}
		- ${receiptsDir}
		- ${profilePhotosDir}`);

	// Check permissions
	fs.accessSync(donationPhotosDir, fs.constants.W_OK);
	fs.accessSync(receiptsDir, fs.constants.W_OK);
	fs.accessSync(profilePhotosDir, fs.constants.W_OK);
	console.log("Write permissions confirmed for upload directories");
} catch (error) {
	console.error("Error setting up upload directories:", error);
	// Don't throw the error, just log it - we'll handle directory issues when uploads happen
}

// Configure storage for donation photos
const donationPhotoStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, donationPhotosDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, `donation-${req.params.donationId}-${uniqueSuffix}${ext}`);
	},
});

// Configure storage for receipt uploads
const receiptStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, receiptsDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, `receipt-${req.params.donationId}-${uniqueSuffix}${ext}`);
	},
});

// Configure storage for profile photos
const profilePhotoStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, profilePhotosDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, `profile-${uniqueSuffix}${ext}`);
	},
});

// File filter to only allow image uploads (for photos)
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

// Create multer instances
const multerUploadDonationPhoto = multer({
	storage: donationPhotoStorage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
	fileFilter: imageFileFilter,
}).single("photo");

const multerUploadReceipt = multer({
	storage: receiptStorage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
	fileFilter: receiptFileFilter,
}).single("receipt");

const multerUploadProfilePhoto = multer({
	storage: profilePhotoStorage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
	fileFilter: imageFileFilter,
}).single("profileImage");

// Wrapper middleware to handle multer errors
export const uploadDonationPhoto = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	console.log("uploadDonationPhoto middleware called");
	console.log("Request headers:", req.headers);
	console.log("Content-Type:", req.headers["content-type"]);

	// Check if the request is multipart/form-data
	if (
		!req.headers["content-type"] ||
		!req.headers["content-type"].includes("multipart/form-data")
	) {
		console.error(
			"Request is not multipart/form-data:",
			req.headers["content-type"]
		);
		return res.status(400).json({
			success: false,
			message: "Request must be multipart/form-data",
			details: {
				contentType: req.headers["content-type"],
				expected: "multipart/form-data",
			},
		});
	}

	multerUploadDonationPhoto(req, res, (err) => {
		if (err) {
			console.error("Multer error:", err);
			console.error("Error stack:", err?.stack);
			console.error("Error type:", typeof err);
			console.error("Error properties:", Object.keys(err || {}));

			if (err instanceof multer.MulterError) {
				// A Multer error occurred when uploading
				console.error("Multer error code:", err.code);
				console.error("Multer error field:", err.field);

				if (err.code === "LIMIT_FILE_SIZE") {
					return res.status(400).json({
						success: false,
						message: "File too large. Maximum size is 5MB.",
						details: {
							code: err.code,
							field: err.field,
							type: "MulterError",
						},
					});
				}

				return res.status(400).json({
					success: false,
					message: `Upload error: ${err.message}`,
					details: {
						code: err.code,
						field: err.field,
						type: "MulterError",
					},
				});
			} else {
				// An unknown error occurred
				return res.status(500).json({
					success: false,
					message: `Upload error: ${err.message}`,
					details: {
						type: typeof err,
						error: err,
					},
				});
			}
		}

		// Check if file exists after upload
		if (!req.file) {
			console.warn("No file uploaded but no error reported");
			console.log("Request body:", req.body);

			return res.status(400).json({
				success: false,
				message: "No file was uploaded",
				details: {
					body: req.body,
					files: req.files,
				},
			});
		} else {
			console.log("File uploaded successfully:", req.file.filename);
			console.log("File details:", {
				fieldname: req.file.fieldname,
				originalname: req.file.originalname,
				mimetype: req.file.mimetype,
				size: req.file.size,
				path: req.file.path,
			});
		}

		next();
	});
};

export const uploadReceipt = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	console.log("uploadReceipt middleware called");
	console.log("Request headers:", req.headers);
	console.log("Content-Type:", req.headers["content-type"]);

	// Check if the request is multipart/form-data
	if (
		!req.headers["content-type"] ||
		!req.headers["content-type"].includes("multipart/form-data")
	) {
		console.error(
			"Request is not multipart/form-data:",
			req.headers["content-type"]
		);
		return res.status(400).json({
			success: false,
			message: "Request must be multipart/form-data",
			details: {
				contentType: req.headers["content-type"],
				expected: "multipart/form-data",
			},
		});
	}

	multerUploadReceipt(req, res, (err) => {
		if (err) {
			console.error("Multer error:", err);
			console.error("Error stack:", err?.stack);
			console.error("Error type:", typeof err);
			console.error("Error properties:", Object.keys(err || {}));

			if (err instanceof multer.MulterError) {
				// A Multer error occurred when uploading
				console.error("Multer error code:", err.code);
				console.error("Multer error field:", err.field);

				if (err.code === "LIMIT_FILE_SIZE") {
					return res.status(400).json({
						success: false,
						message: "File too large. Maximum size is 5MB.",
						details: {
							code: err.code,
							field: err.field,
							type: "MulterError",
						},
					});
				}

				return res.status(400).json({
					success: false,
					message: `Upload error: ${err.message}`,
					details: {
						code: err.code,
						field: err.field,
						type: "MulterError",
					},
				});
			} else {
				// An unknown error occurred
				return res.status(500).json({
					success: false,
					message: `Upload error: ${err.message}`,
					details: {
						type: typeof err,
						error: err,
					},
				});
			}
		}

		// Check if file exists after upload
		if (!req.file) {
			console.warn("No file uploaded but no error reported");
			console.log("Request body:", req.body);

			return res.status(400).json({
				success: false,
				message: "No file was uploaded",
				details: {
					body: req.body,
					files: req.files,
				},
			});
		} else {
			console.log("File uploaded successfully:", req.file.filename);
			console.log("File details:", {
				fieldname: req.file.fieldname,
				originalname: req.file.originalname,
				mimetype: req.file.mimetype,
				size: req.file.size,
				path: req.file.path,
			});
		}

		next();
	});
};

export const uploadProfilePhoto = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	console.log("uploadProfilePhoto middleware called");
	console.log("Request headers:", req.headers);
	console.log("Content-Type:", req.headers["content-type"]);

	// Check if the request is multipart/form-data
	if (
		!req.headers["content-type"] ||
		!req.headers["content-type"].includes("multipart/form-data")
	) {
		console.error(
			"Request is not multipart/form-data:",
			req.headers["content-type"]
		);
		return res.status(400).json({
			success: false,
			message: "Request must be multipart/form-data",
			details: {
				contentType: req.headers["content-type"],
				expected: "multipart/form-data",
			},
		});
	}

	multerUploadProfilePhoto(req, res, (err) => {
		if (err) {
			console.error("Multer error:", err);
			console.error("Error stack:", err?.stack);
			console.error("Error type:", typeof err);
			console.error("Error properties:", Object.keys(err || {}));

			if (err instanceof multer.MulterError) {
				// A Multer error occurred when uploading
				console.error("Multer error code:", err.code);
				console.error("Multer error field:", err.field);

				if (err.code === "LIMIT_FILE_SIZE") {
					return res.status(400).json({
						success: false,
						message: "File too large. Maximum size is 5MB.",
						details: {
							code: err.code,
							field: err.field,
							type: "MulterError",
						},
					});
				}

				return res.status(400).json({
					success: false,
					message: `Upload error: ${err.message}`,
					details: {
						code: err.code,
						field: err.field,
						type: "MulterError",
					},
				});
			} else {
				// An unknown error occurred
				return res.status(500).json({
					success: false,
					message: `Upload error: ${err.message}`,
					details: {
						type: typeof err,
						error: err,
					},
				});
			}
		}

		// Check if file exists after upload
		if (!req.file) {
			console.warn("No file uploaded but no error reported");
			console.log("Request body:", req.body);

			return res.status(400).json({
				success: false,
				message: "No file was uploaded",
				details: {
					body: req.body,
					files: req.files,
				},
			});
		} else {
			console.log("File uploaded successfully:", req.file.filename);
			console.log("File details:", {
				fieldname: req.file.fieldname,
				originalname: req.file.originalname,
				mimetype: req.file.mimetype,
				size: req.file.size,
				path: req.file.path,
			});
		}

		next();
	});
};

// Cloudinary-based upload middleware for donation photos
export const uploadDonationPhotoToCloudinary = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		console.log("uploadDonationPhotoToCloudinary middleware called");

		// Check if the request is multipart/form-data
		if (
			!req.headers["content-type"] ||
			!req.headers["content-type"].includes("multipart/form-data")
		) {
			return res.status(400).json({
				success: false,
				message: "Request must be multipart/form-data",
			});
		}

		// Use multer to handle the file upload to memory
		const upload = multer({
			storage: multer.memoryStorage(),
			limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
			fileFilter: imageFileFilter,
		}).single("photo");

		upload(req, res, async (err) => {
			if (err) {
				console.error("Multer error:", err);
				return res.status(400).json({
					success: false,
					message: err.message || "File upload error",
				});
			}

			if (!req.file) {
				return res.status(400).json({
					success: false,
					message: "No photo file provided",
				});
			}

			try {
				// Create a temporary file for Cloudinary upload using OS temp directory
				const os = require('os');
				const tempDir = os.tmpdir();
				const tempFilePath = path.join(tempDir, `donation-photo-${Date.now()}-${req.file.originalname}`);
				fs.writeFileSync(tempFilePath, req.file.buffer);

				// Create a file object that matches Express.Multer.File interface
				const fileForCloudinary = {
					...req.file,
					path: tempFilePath,
				} as Express.Multer.File;

				// Upload to Cloudinary
				const cloudinaryResult = await uploadToCloudinary(
					fileForCloudinary,
					"donation-photos"
				);

				// Clean up temp file
				if (fs.existsSync(tempFilePath)) {
					fs.unlinkSync(tempFilePath);
				}

				// Add Cloudinary result to request object
				(req as any).cloudinaryResult = cloudinaryResult;

				console.log("✅ Photo uploaded to Cloudinary:", cloudinaryResult.url);
				next();
			} catch (cloudinaryError) {
				console.error("Cloudinary upload error:", cloudinaryError);
				return res.status(500).json({
					success: false,
					message: "Failed to upload photo to cloud storage",
					error: cloudinaryError,
				});
			}
		});
	} catch (error) {
		console.error("Upload middleware error:", error);
		return res.status(500).json({
			success: false,
			message: "Upload middleware error",
			error,
		});
	}
};



// Cloudinary-based upload middleware for profile photos
export const uploadProfilePhotoToCloudinary = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		console.log("uploadProfilePhotoToCloudinary middleware called");

		// Check if the request is multipart/form-data
		if (
			!req.headers["content-type"] ||
			!req.headers["content-type"].includes("multipart/form-data")
		) {
			return res.status(400).json({
				success: false,
				message: "Request must be multipart/form-data",
			});
		}

		// Use multer to handle the file upload to memory
		const upload = multer({
			storage: multer.memoryStorage(),
			limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
			fileFilter: imageFileFilter,
		}).single("profileImage");

		upload(req, res, async (err) => {
			if (err) {
				console.error("Multer error:", err);
				return res.status(400).json({
					success: false,
					message: err.message || "File upload error",
				});
			}

			if (!req.file) {
				return res.status(400).json({
					success: false,
					message: "No profile image file provided",
				});
			}

			try {
				// Upload to Cloudinary
				const result = await uploadBufferToCloudinary(
					req.file.buffer,
					"profile-photos",
					{
						width: 400,
						height: 400,
						crop: "fill",
						gravity: "face",
						quality: "auto",
						format: "jpg",
					}
				);

				console.log("✅ Profile photo uploaded to Cloudinary:", result.secure_url);

				// Add Cloudinary URL to request for controller to use
				req.cloudinaryUrl = result.secure_url;
				req.cloudinaryPublicId = result.public_id;

				next();
			} catch (uploadError) {
				console.error("❌ Cloudinary upload error:", uploadError);
				return res.status(500).json({
					success: false,
					message: "Failed to upload profile photo to cloud storage",
				});
			}
		});
	} catch (error) {
		console.error("❌ Profile photo upload middleware error:", error);
		return res.status(500).json({
			success: false,
			message: "Internal server error during profile photo upload",
		});
	}
};

// Cloudinary-based upload middleware for receipts
export const uploadReceiptToCloudinary = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		console.log("uploadReceiptToCloudinary middleware called");

		// Check if the request is multipart/form-data
		if (
			!req.headers["content-type"] ||
			!req.headers["content-type"].includes("multipart/form-data")
		) {
			return res.status(400).json({
				success: false,
				message: "Request must be multipart/form-data",
			});
		}

		// Use multer to handle the file upload to memory
		const upload = multer({
			storage: multer.memoryStorage(),
			limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
			fileFilter: receiptFileFilter,
		}).single("receipt");

		upload(req, res, async (err) => {
			if (err) {
				console.error("Multer error:", err);
				return res.status(400).json({
					success: false,
					message: err.message || "File upload error",
				});
			}

			if (!req.file) {
				return res.status(400).json({
					success: false,
					message: "No receipt file provided",
				});
			}

			try {
				// Create a temporary file for Cloudinary upload using OS temp directory
				const os = require('os');
				const tempDir = os.tmpdir();
				const tempFilePath = path.join(tempDir, `receipt-${Date.now()}-${req.file.originalname}`);
				fs.writeFileSync(tempFilePath, req.file.buffer);

				// Create a file object that matches Express.Multer.File interface
				const fileForCloudinary = {
					...req.file,
					path: tempFilePath,
				} as Express.Multer.File;

				// Upload to Cloudinary (receipts can be images or PDFs)
				const cloudinaryResult = await uploadToCloudinary(
					fileForCloudinary,
					"receipts"
				);

				// Clean up temp file
				if (fs.existsSync(tempFilePath)) {
					fs.unlinkSync(tempFilePath);
				}

				// Add Cloudinary result to request object
				(req as any).cloudinaryResult = cloudinaryResult;

				console.log("✅ Receipt uploaded to Cloudinary:", cloudinaryResult.url);
				next();
			} catch (cloudinaryError) {
				console.error("Cloudinary upload error:", cloudinaryError);
				return res.status(500).json({
					success: false,
					message: "Failed to upload receipt to cloud storage",
					error: cloudinaryError,
				});
			}
		});
	} catch (error) {
		console.error("Upload middleware error:", error);
		return res.status(500).json({
			success: false,
			message: "Upload middleware error",
			error,
		});
	}
};
