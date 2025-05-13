import express from "express";
import {
	getCauses,
	getCauseDetails,
	createCause,
	updateCause,
	deleteCause,
	getOrganizationCauses,
	getDonorCauses,
} from "../controllers/cause.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize, isOrganization } from "../middleware/role.middleware";

const router = express.Router();

// Public routes
router.get("/", getCauses);
router.get("/:causeId", getCauseDetails);

// Protected routes - Organization only
router.post("/", authenticate, isOrganization, createCause);
router.put("/:causeId", authenticate, isOrganization, updateCause);
router.delete(
	"/:causeId",
	authenticate,
	isOrganization,
	deleteCause
);

// Organization routes
router.get("/organization/:organizationId", getOrganizationCauses);

// Donor routes
router.get("/donor/supported", authenticate, getDonorCauses);

export default router;
