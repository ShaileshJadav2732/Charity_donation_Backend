import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import {
	completeOrganizationProfile,
	getOrganizationProfile,
	updateOrganizationProfile,
	getAllOrganizations,
} from "../controllers/organization/organization.controller";
import { checkOrganizationProfileCompleted } from "../middlewares/checkOrgProfile";
const router = Router();

// Protected routes
router.post(
	"/create",
	authenticate,
	authorizeRoles("organization"), // Ensure the user has the 'organization' role
	completeOrganizationProfile
);

router.get(
	"/profile",
	authenticate,
	authorizeRoles("organization"),
	checkOrganizationProfileCompleted,
	getOrganizationProfile
);
router.put(
	"/profile",
	authenticate,
	authorizeRoles("organization"),
	checkOrganizationProfileCompleted,
	updateOrganizationProfile
);

router.get("/all", getAllOrganizations); // Public route to view all organizations

export default router;
