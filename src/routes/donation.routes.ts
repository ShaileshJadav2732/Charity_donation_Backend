import express from "express";
import {
	createDonation,
	getDonationById,
	getMyDonations,
} from "../controllers/donor/donation.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { getDonationsForOrganization } from "../controllers/donor/donation.controller";
import { authorizeRoles } from "../middlewares/role.middleware";

const router = express.Router();

router.post("/create", authenticate, createDonation);
router.get("/my-donations", authenticate, getMyDonations);
router.get("/my-donations/:id", authenticate, getDonationById);

router.get(
	"/organization",
	authenticate,
	authorizeRoles("organization"),
	getDonationsForOrganization
);

export default router;
