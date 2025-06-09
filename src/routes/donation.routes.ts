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
} from "../middleware/cloudinary.middleware";

const router = express.Router();

router.use(authenticate);

router.post("/", createDonation);

router.get("/", authorize(["donor"]), getDonorDonations);

router.get("/:id", getDonationById);

router.get(
	"/organization/:organizationId",
	authorize(["organization"]), // Adjust permissions as needed
	findOrganizationPendingDonations
);

router.get("/donor/stats", getDonorStats);

router.get("/items/analytics", getItemDonationAnalytics);

router.get("/items/:type/analytics", getItemDonationTypeAnalytics);

router.patch("/:donationId/status", updateDonationStatus);

router.patch(
	"/:donationId/received",
	authorize(["organization"]),
	uploadDonationPhotoToCloudinary,
	markDonationAsReceived
);

router.patch(
	"/:donationId/confirm",

	authorize(["donor"]),
	confirmDonationReceipt
);

router.patch(
	"/:donationId/confirm-auto",

	authorize(["organization"]),
	markDonationAsConfirmed
);

router.patch(
	"/:donationId/confirmed",

	authorize(["organization"]),
	uploadReceiptToCloudinary,
	markDonationAsConfirmed
);

export default router;
