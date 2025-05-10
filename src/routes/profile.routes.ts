import { Router } from "express";
import * as profileController from "../controllers/profile.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isDonor, isOrganization } from "../middleware/role.middleware";

const router = Router();

// Donor profile routes
router.post(
	"/donor",
	authenticate,
	isDonor,
	profileController.completeDonorProfile
);
router.get("/donor", authenticate, isDonor, profileController.getDonorProfile);

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

export default router;
