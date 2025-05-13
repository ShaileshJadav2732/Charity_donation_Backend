import express from "express";
import {
	createDonation,
	getDonations,
	getDonation,
	updateDonation,
	deleteDonation,
	getOrganizationDonations,
	getUserDonations,
	updateDonationStatus,
} from "../controllers/donation.controller";
import { protect, authorize } from "../middleware/auth";
import { upload, handleMulterError } from "../middleware/upload";
import { UserRole } from "../types/enums";

const router = express.Router();

// Public routes
router.get("/", getDonations);
router.get("/:id", getDonation);

// Protected routes
router.use(protect);

// User routes
router.get("/user/me", getUserDonations);

// Organization routes
router.use(authorize(UserRole.ORGANIZATION, UserRole.ADMIN));
router.get("/organization/me", getOrganizationDonations);
router.post("/", upload.single("image"), handleMulterError, createDonation);
router.put("/:id", upload.single("image"), handleMulterError, updateDonation);
router.delete("/:id", deleteDonation);
router.patch("/:id/status", updateDonationStatus);

export default router;
