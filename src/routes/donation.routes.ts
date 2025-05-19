import express from "express";
import {
	cancelDonation,
	createDonation,
	findOrganizationPendingDonations,
	getDonationDetails,
	getDonorDonations,
	getDonorStats,
	// getPendingDonations,
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

// Get specific donation details
router.get("/:donationId", getDonationDetails);

// /donations/aagiinnoortz;
// Update donation status (only for cancellation by donor)

router.patch("/:donationId/status", updateDonationStatus);

// Cancel donation (donor or organization)
router.patch(
	"/:id/cancel",
	authenticate,
	authorize(["donor", "organization"]),
	cancelDonation
);

export default router;
