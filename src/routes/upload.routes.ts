import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware";
import {
	uploadCauseImage,
	uploadCampaignImage,
	uploadOrganizationLogo,
	deleteImage,
} from "../controllers/upload.controller";

const router = express.Router();

// Configure multer for temporary file storage
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "/tmp"); // Use system temp directory
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const ext = file.originalname.split(".").pop();
		cb(null, `upload-${uniqueSuffix}.${ext}`);
	},
});

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

// Create multer instance
const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: imageFileFilter,
});

// Routes
router.post(
	"/cause-image",
	authenticate,
	upload.single("image"),
	uploadCauseImage
);

router.post(
	"/campaign-image",
	authenticate,
	upload.single("image"),
	uploadCampaignImage
);

router.post(
	"/organization-logo",
	authenticate,
	upload.single("image"),
	uploadOrganizationLogo
);

router.delete("/image", authenticate, deleteImage);

export default router;
