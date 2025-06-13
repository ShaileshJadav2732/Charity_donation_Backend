import express from "express";
import {
	getCauses,
	createCause,
	updateCause,
	deleteCause,
	getOrganizationCauses,
	getActiveCampaignCauses,
	getCauseById,
	getOrganizationUserIdByCauseId,
	getCampaignsForCause,
	cleanupDuplicates,
} from "../controllers/cause.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
const router = express.Router();

router.get("/", getCauses);
router.get("/active-campaigns", getActiveCampaignCauses);

// More specific causeId routes
router.get(
	"/:causeId/organization-user-id",
	authenticate,
	getOrganizationUserIdByCauseId
);
router.get("/:causeId/campaigns", authenticate, getCampaignsForCause);

// Utility route for cleaning up duplicates
router.post("/cleanup-duplicates", authenticate, cleanupDuplicates);

// General route (keep after causeId-specific routes)
router.get("/:id", getCauseById);

// Protected routes - Organization only
router.post("/", authenticate, authorize(["organization"]), createCause);
router.get(
	"/organization/:organizationId",
	authenticate,
	authorize(["organization"]),
	getOrganizationCauses
);
router.put("/:id", authenticate, authorize(["organization"]), updateCause);
router.delete("/:id", authenticate, authorize(["organization"]), deleteCause);

export default router;
