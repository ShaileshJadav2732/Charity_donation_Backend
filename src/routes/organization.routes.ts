import express from "express";
import {
	getOrganizationById,
	getOrganizationByCauseId,
	getCurrentOrganization,
	getOrganizationDonors,
	getOrganizationCampaigns,
} from "../controllers/organization.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
const router = express.Router();
router.use(authenticate);

router.get("/me", authorize(["organization"]), getCurrentOrganization);
router.get("/donors", authorize(["organization"]), getOrganizationDonors);
router.get("/:organizationId/campaigns", getOrganizationCampaigns);
router.get("/cause/:causeId", authorize(["donor"]), getOrganizationByCauseId);
router.get("/:id", getOrganizationById);

export default router;
