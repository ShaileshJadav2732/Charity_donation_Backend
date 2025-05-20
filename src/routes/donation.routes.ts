import express from "express";
import {
	createDonation,
	findOrganizationPendingDonations,
	getDonorDonations,
	getDonorStats,
	updateDonationStatus,
} from "../controllers/donation.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();
// All routes require authentication
router.use(authenticate);

// Create a new donation
router.post("/", createDonation);
// router.get("/organization", authorize(["organization"]), getPendingDonations);
// Get donor's donations with optional filtering
router.get("/", getDonorDonations);

router.get(
	"/organization/:organizationId",
	authorize(["organization"]), // Adjust permissions as needed
	findOrganizationPendingDonations
);
router.get("/donor/stats", getDonorStats);
router.patch("/:donationId/status", authenticate, updateDonationStatus);

// Get specific donation details

export default router;
