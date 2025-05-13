import express from "express";
import { protect, authorize, verifyOrganization } from "../middleware/auth";
import { upload, handleMulterError } from "../middleware/upload";
import { UserRole } from "../types/enums";
import {
   createCampaign,
   getCampaigns,
   getCampaignById as getCampaign,
   updateCampaign,
   deleteCampaign,
   getCampaignUpdates,
   createCampaignUpdate as addCampaignUpdate,
} from "../controllers/campaign.controller";

const router = express.Router();

// Public routes
router.get("/", getCampaigns);
router.get("/:id", getCampaign);
router.get("/:id/updates", getCampaignUpdates);

// Protected routes
router.use(protect);

// Organization routes
router.use(authorize(UserRole.ORGANIZATION, UserRole.ADMIN));
router.use(verifyOrganization);

// Campaign management routes
router.route("/")
   .post(upload.single("image"), handleMulterError, createCampaign);

router.route("/:id")
   .put(upload.single("image"), handleMulterError, updateCampaign)
   .delete(deleteCampaign);

router.route("/:id/updates")
   .post(addCampaignUpdate);

export default router; 