import express from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
	uploadCauseImage,
	uploadCampaignImage,
	uploadOrganizationLogo,
	deleteImage,
} from "../controllers/upload.controller";
import {
	uploadCauseImageToCloudinary,
	uploadCampaignImageToCloudinary,
	uploadOrganizationLogoToCloudinary,
} from "../middleware/cloudinary.middleware";

const router = express.Router();

// Routes - All uploads now go directly to Cloudinary
router.post(
	"/cause-image",
	authenticate,
	uploadCauseImageToCloudinary,
	uploadCauseImage
);

router.post(
	"/campaign-image",
	authenticate,
	uploadCampaignImageToCloudinary,
	uploadCampaignImage
);

router.post(
	"/organization-logo",
	authenticate,
	uploadOrganizationLogoToCloudinary,
	uploadOrganizationLogo
);

router.delete("/image", authenticate, deleteImage);

export default router;
