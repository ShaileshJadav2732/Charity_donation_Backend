import express from "express";
import {
	getOrganizationById,
	getOrganizationByCauseId,
	getCurrentOrganization,
} from "../controllers/organization.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
const router = express.Router();
router.use(authenticate);
// Public routes
router.get("/me", authorize(["organization"]), getCurrentOrganization);
router.get("/cause/:causeId", authorize(["donor"]), getOrganizationByCauseId);
router.get("/:id", getOrganizationById);

export default router;
