import express, { Router } from "express";
import {
   getCampaigns,
   getCampaignById,
   createCampaign,
   updateCampaign,
   deleteCampaign,
   addCauseToCampaign,
   removeCauseFromCampaign,
   addOrganizationToCampaign,
   removeOrganizationFromCampaign,
} from "../controllers/campaign.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isOrganization } from "../middleware/role.middleware";

const router: Router = express.Router();

// Public routes
router.get("/", getCampaigns);
router.get("/:id", getCampaignById);

// Protected routes (require authentication)
router.use(authenticate);

// Organization-only routes
router.post("/", isOrganization, createCampaign);
router.patch("/:id", isOrganization, updateCampaign);
router.delete("/:id", isOrganization, deleteCampaign);

// Campaign management routes
router.post("/:id/causes", isOrganization, addCauseToCampaign);
router.delete("/:id/causes/:causeId", isOrganization, removeCauseFromCampaign);
router.post("/:id/organizations", isOrganization, addOrganizationToCampaign);
router.delete("/:id/organizations/:organizationId", isOrganization, removeOrganizationFromCampaign);

export default router; 