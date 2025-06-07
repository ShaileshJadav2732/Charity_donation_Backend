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
router.use(authenticate);
// Public routes
router.get("/", getCauses);
router.get("/active-campaigns", getActiveCampaignCauses);

// Get organization User ID by cause ID for messaging (authenticated users only)
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
// Make cause details accessible to all authenticated users
router.get("/:id", getCauseById);
router.put("/:id", authenticate, authorize(["organization"]), updateCause);
router.delete(
	"/:causeId",
	authenticate,
	authorize(["organization"]),
	deleteCause
);

export default router;
