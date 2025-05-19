import express from "express";
import {
	getCauses,
	// getCauseDetails,
	createCause,
	updateCause,
	deleteCause,
	getOrganizationCauses,
	getDonorCauses,
	getActiveCampaignCauses,
	getCauseById,
} from "../controllers/cause.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// Public routes
router.get("/", getCauses);
router.get("/active-campaigns", getActiveCampaignCauses);
router.get("/:causeId", getCauseById);

// Protected routes - Organization only
router.post("/", authenticate, authorize(["organization"]), createCause);
router.put("/:id", authenticate, authorize(["organization"]), updateCause);
router.delete(
	"/:causeId",
	authenticate,
	authorize(["organization"]),
	deleteCause
);

// Organization routes
router.get("/organization/:organizationId", getOrganizationCauses);

// Donor routes
router.get("/donor/supported", getDonorCauses);

export default router;
