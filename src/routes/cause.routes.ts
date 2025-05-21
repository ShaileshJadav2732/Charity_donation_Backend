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

// Protected routes - Organization only
router.post("/", authenticate, authorize(["organization"]), createCause);
router.get(
	"/organization/:organizationId",
	authorize(["organization"]),
	getOrganizationCauses
);
// Make cause details accessible to all authenticated users
router.get("/:id", getCauseById);
router.put("/:id", authenticate, authorize(["organization"]), updateCause);
router.delete(
	"/:causeId",
	authenticate,
	authorize(["organization"]),
	deleteCause
);

// Organization routes

// Donor routes
router.get("/donor/supported", getDonorCauses);

export default router;
