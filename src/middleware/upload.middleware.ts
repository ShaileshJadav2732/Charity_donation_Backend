import multer from "multer";
import path from "path";
import fs from "fs-extra";
import { Request, Response, NextFunction } from "express";

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

// File filter to only allow image uploads
const fileFilter = (
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

// Create multer instances
const multerUploadDonationPhoto = multer({
	storage: donationPhotoStorage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
	fileFilter,
}).single("photo");

const multerUploadReceipt = multer({
	storage: receiptStorage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
	fileFilter,
}).single("receipt");

const multerUploadProfilePhoto = multer({
	storage: profilePhotoStorage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB max file size
	},
	fileFilter,
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
