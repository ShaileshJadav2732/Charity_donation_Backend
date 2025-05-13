import express from "express";
import {
	createCampaign,
	getCampaigns,
	getCampaignDetails,
	updateCampaign,
	updateCampaignStatus,
} from "../controllers/campaign.controller";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// Public routes
router.get("/", getCampaigns);
router.get("/:campaignId", getCampaignDetails);

// Protected routes (require authentication)
router.use(authenticate);

// Organization-only routes
router.post("/", authorize(["organization"]), createCampaign);
router.patch("/:campaignId", authorize(["organization"]), updateCampaign);
router.patch(
	"/:campaignId/status",
	authorize(["organization"]),
	updateCampaignStatus
);

export default router;
