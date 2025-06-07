import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isDonor, isOrganization } from "../middleware/role.middleware";
import { uploadProfilePhotoToCloudinary } from "../middleware/cloudinary.middleware";

const router = Router();

// Donor profile routes
router.post(
	"/donor",
	authenticate,
	isDonor,
	profileController.completeDonorProfile
);
router.get("/donor", authenticate, isDonor, profileController.getDonorProfile);
router.put(
	"/donor",
	authenticate,
	isDonor,
	profileController.updateDonorProfile
);

// Donor profile image upload (using Cloudinary)
router.post(
	"/donor/avatar",
	authenticate,
	isDonor,
	uploadProfilePhotoToCloudinary,
	profileController.uploadDonorProfileImage
);

// Organization profile routes
router.post(
	"/organization",
	authenticate,
	isOrganization,
	profileController.completeOrganizationProfile
);
router.get(
	"/organization",
	authenticate,
	isOrganization,
	profileController.getOrganizationProfile
);
router.put(
	"/organization",
	authenticate,
	isOrganization,
	profileController.updateOrganizationProfile
);

export default router;
