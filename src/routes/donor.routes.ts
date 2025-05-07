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

const router = express.Router();

// All routes require authentication
router.use(validateFirebaseToken);

// Get donor profile - donor only
router.get("/profile", requireRole("donor"), getDonorProfile);

// Complete donor profile - donor only
router.post("/complete-profile", requireRole("donor"), completeDonorProfile);

// Update donor profile - donor only
router.put("/update-profile", requireRole("donor"), updateDonorProfile);

export default router;
