import express from "express";
import {
	createDonation,
	getDonations,
	getDonationById,
	updateDonationStatus,
	cancelDonation,
} from "../controllers/donation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// Create donation
router.post("/", authenticate, createDonation);

// Get all donations (with filters)
router.get("/", authenticate, getDonations);

// Get single donation
router.get("/:id", authenticate, getDonationById);

// Update donation status (organization only)
router.patch(
	"/:id/status",
	authenticate,
	authorize(["organization"]),
	updateDonationStatus
);

// Cancel donation (donor or organization)
router.patch(
	"/:id/cancel",
	authenticate,
	authorize(["donor", "organization"]),
	cancelDonation
);

export default router;
