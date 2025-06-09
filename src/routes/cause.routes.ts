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
} from "../controllers/cause.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// Public routes (no authentication required)
router.get("/", getCauses);
router.get("/active-campaigns", getActiveCampaignCauses);
router.get("/:id", getCauseById);

// Protected routes - Authenticated users only
router.get(
	"/:causeId/organization-user-id",
	authenticate,
	getOrganizationUserIdByCauseId
);

// Protected routes - Organization only
router.post("/", authenticate, authorize(["organization"]), createCause);
router.get(
	"/organization/:organizationId",
	authenticate,
	authorize(["organization"]),
	getOrganizationCauses
);
router.put("/:id", authenticate, authorize(["organization"]), updateCause);
router.delete(
	"/:causeId",
	authenticate,
	authorize(["organization"]),
	deleteCause
);

export default router;
