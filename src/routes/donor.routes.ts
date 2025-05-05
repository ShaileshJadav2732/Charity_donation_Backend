import express from "express";
import {
	getDonorProfile,
	completeDonorProfile,
	updateDonorProfile,
} from "../controllers/donor.controller";
import { auth, authorize } from "../middleware/auth.middleware";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Donor routes
router.get("/profile", authorize("donor"), getDonorProfile);
router.post("/complete-profile", authorize("donor"), completeDonorProfile);
router.put("/update-profile", authorize("donor"), updateDonorProfile);

export default router;
