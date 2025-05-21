import express from "express";
import {
	createDonation,
	findOrganizationPendingDonations,
	getDonorDonations,
	getDonorStats,
	getItemDonationAnalytics,
	getItemDonationTypeAnalytics,
	updateDonationStatus,
} from "../controllers/donation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();
// All routes require authentication
router.use(authenticate);

// Create a new donation
router.post("/", createDonation);

// Get donor's donations with optional filtering
router.get("/", getDonorDonations);

// Get organization's pending donations
router.get(
	"/organization/:organizationId",
	authorize(["organization"]), // Adjust permissions as needed
	findOrganizationPendingDonations
);

// Get donation statistics
router.get("/donor/stats", getDonorStats);

// Get item donation analytics
router.get("/items/analytics", getItemDonationAnalytics);

// Get analytics for a specific item donation type
router.get("/items/:type/analytics", getItemDonationTypeAnalytics);

// Update donation status
router.patch("/:donationId/status", authenticate, updateDonationStatus);

export default router;
