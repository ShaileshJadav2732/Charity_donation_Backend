import { authenticate } from "./../middleware/auth.middleware";
import express from "express";
import {
	confirmDonationReceipt,
	createDonation,
	findOrganizationPendingDonations,
	getDonationById,
	getDonorDonations,
	getDonorStats,
	getItemDonationAnalytics,
	getItemDonationTypeAnalytics,
	markDonationAsReceived,
	markDonationAsConfirmed,
	updateDonationStatus,
} from "../controllers/donation.controller";

import { authorize } from "../middleware/role.middleware";
import {
	uploadDonationPhotoToCloudinary,
	uploadReceiptToCloudinary,
} from "../middleware/upload.middleware";

const router = express.Router();
// All routes require authentication
router.use(authenticate);

// Test authentication endpoint
router.get("/test-auth", (req: express.Request, res: express.Response) => {
	res.json({
		success: true,
		message: "Authentication working",
		user: req.user,
	});
});

// Create a new donation
router.post("/", createDonation);

// Get donor's donations with optional filtering
router.get(
	"/",
	authorize(["donor"]),
	getDonorDonations
);

// Get a single donation by ID
router.get("/:id", getDonationById);

// Debug endpoint to check donation status
router.get("/:id/debug", authenticate, async (req, res) => {
	try {
		const { id } = req.params;
		const donation = await require("../models/donation.model").default.findById(id)
			.populate("donor", "email")
			.populate("organization", "name email");

		if (!donation) {
			return res.json({ error: "Donation not found" });
		}

		const organization = await require("../models/organization.model").default.findOne({
			_id: donation.organization._id,
			userId: req.user._id,
		});

		res.json({
			donation: {
				id: donation._id,
				status: donation.status,
				organizationId: donation.organization._id,
				donorId: donation.donor._id,
			},
			user: {
				id: req.user._id,
				role: req.user.role,
			},
			organization: organization ? "Found" : "Not found",
			canConfirm: donation.status === "RECEIVED" && !!organization,
		});
	} catch (error) {
		res.json({ error: error.message });
	}
});

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
router.patch("/:donationId/status", updateDonationStatus);

// Mark donation as received with photo upload (using Cloudinary)
router.patch(
	"/:donationId/received",
	authenticate,
	authorize(["organization"]),
	uploadDonationPhotoToCloudinary,
	markDonationAsReceived
);

// Confirm donation receipt by donor
router.patch(
	"/:donationId/confirm",
	authenticate,
	authorize(["donor"]),
	confirmDonationReceipt
);

// Mark donation as confirmed with automatic PDF receipt generation (for organizations)
router.patch(
	"/:donationId/confirm-auto",
	authenticate,
	authorize(["organization"]),
	markDonationAsConfirmed
);

// Legacy route for manual receipt upload (kept for backward compatibility)
// This route still requires file upload middleware
router.patch(
	"/:donationId/confirmed",
	authenticate,
	authorize(["organization"]),
	uploadReceiptToCloudinary,
	markDonationAsConfirmed
);

export default router;
