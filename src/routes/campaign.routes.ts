import express from "express";
import {
	createCampaign,
	deleteCampaign,
	getCampaignById,
	getCampaignDetails,
	getCampaignDetailsWithDonations,
	getCampaigns,
	updateCampaign,
} from "../controllers/campaign.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// Public routes
router.get("/", getCampaigns);
router.get("/:campaignId", getCampaignById);
router.get("/:campaignId/details", getCampaignDetails);
router.get(
	"/:campaignId/details-with-donations",
	getCampaignDetailsWithDonations
);

// Protected routes (require authentication)
router.use(authenticate);

// Organization-only routes
router.post("/", authorize(["organization"]), createCampaign);
router.patch("/:campaignId", authorize(["organization"]), updateCampaign);
router.delete("/:campaignId", authorize(["organization"]), deleteCampaign);

export default router;
