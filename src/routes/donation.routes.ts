import express from "express";
import {
	createDonation,
	getDonorDonations,
	getOrganizationDonations,
	getDonationById,
	updateDonationStatus,
	cancelDonation,
} from "../controllers/donation.controller";
import { auth, authorize } from "../middleware/auth.middleware";

const router = express.Router();

// All routes require authentication
router.use(auth);

// Donor routes
router.post("/", authorize("donor"), createDonation);
router.get("/my-donations", authorize("donor"), getDonorDonations);
router.put("/:id/cancel", authorize("donor"), cancelDonation);

// Organization routes
router.get(
	"/org-donations",
	authorize("organization"),
	getOrganizationDonations
);
router.put("/:id/status", authorize("organization"), updateDonationStatus);

// Common routes
router.get("/:id", getDonationById);

export default router;
