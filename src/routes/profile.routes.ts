import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isDonor, isOrganization } from "../middleware/role.middleware";
import { uploadProfilePhotoToCloudinary } from "../middleware/cloudinary.middleware";

const router = Router();

router.use(authenticate);

// Donor profile routes
router.post("/donor", isDonor, profileController.completeDonorProfile);
router.get("/donor", isDonor, profileController.getDonorProfile);
router.put("/donor", isDonor, profileController.updateDonorProfile);

// Donor profile image upload (Cloudinary)
router.post(
	"/donor/avatar",
	isDonor,
	uploadProfilePhotoToCloudinary,
	profileController.uploadDonorProfileImage
);

// Organization profile routes
router.post(
	"/organization",
	isOrganization,
	profileController.completeOrganizationProfile
);
router.get(
	"/organization",
	isOrganization,
	profileController.getOrganizationProfile
);
router.put(
	"/organization",
	isOrganization,
	profileController.updateOrganizationProfile
);

export default router;
