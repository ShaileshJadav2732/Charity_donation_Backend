import express from "express";
import {
	getDonorProfile,
	completeDonorProfile,
	updateDonorProfile,
} from "../controllers/donor.controller";
import {
	validateFirebaseToken,
	requireRole,
} from "../controllers/auth/firebase-auth.controller";
import { authorize } from "../middleware/auth.middleware";
import { requireCompletedProfileAccess } from "../middleware/profile-complete.middleware";

const router = express.Router();

// All routes require authentication
router.use(validateFirebaseToken);

// Get donor profile - donor only
router.get(
	"/profile",
	authorize,
	requireRole("donor"),
	requireCompletedProfileAccess,
	getDonorProfile
);

// Complete donor profile - donor only
router.post(
	"/complete-profile",
	authorize,
	requireRole("donor"),
	completeDonorProfile
);

// Update donor profile - donor only
router.put("/update-profile", requireRole("donor"), updateDonorProfile);

export default router;
