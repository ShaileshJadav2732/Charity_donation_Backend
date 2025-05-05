import express from "express";
import {
	getOrganizationProfile,
	completeOrganizationProfile,
	updateOrganizationProfile,
	listOrganizations,
	getOrganizationById,
} from "../controllers/organization.controller";
import { auth, authorize } from "../middleware/auth.middleware";

const router = express.Router();

// Public routes
router.get("/", listOrganizations);
router.get("/:id", getOrganizationById);

// Protected routes
router.use(auth);
router.get("/profile", authorize("organization"), getOrganizationProfile);
router.post(
	"/complete-profile",
	authorize("organization"),
	completeOrganizationProfile
);
router.put(
	"/update-profile",
	authorize("organization"),
	updateOrganizationProfile
);

export default router;
