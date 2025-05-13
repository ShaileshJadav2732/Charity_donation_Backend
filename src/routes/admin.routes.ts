import express from "express";
import {
	getPlatformStats,
	getVerificationRequests,
	updateVerificationStatus,
} from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize(["admin"]));

// Get platform statistics
router.get("/stats", getPlatformStats);

// Get organization verification requests
router.get("/organizations/verification", getVerificationRequests);

// Update organization verification status
router.patch("/organizations/:organizationId/verify", updateVerificationStatus);

export default router;
