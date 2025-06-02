import express from "express";
import {
	createCampaign,
	getCampaigns,
	getCampaignById,
	getCampaignDetails,
	updateCampaign,
	deleteCampaign,
	addCauseToCampaign,
	removeCauseFromCampaign,
} from "../controllers/campaign.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// Public routes
router.get("/", getCampaigns);
router.get("/:campaignId", getCampaignById);
router.get("/:campaignId/details", getCampaignDetails);

// Protected routes (require authentication)
router.use(authenticate);

// Organization-only routes
router.post("/", authorize(["organization"]), createCampaign);
router.patch("/:campaignId", authorize(["organization"]), updateCampaign);
router.delete("/:campaignId", authorize(["organization"]), deleteCampaign);

export default router;
