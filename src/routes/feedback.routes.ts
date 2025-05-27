import express from "express";
import {
	createFeedback,
	getOrganizationFeedback,
	getFeedbackStats,
	updateFeedbackStatus,
	checkFeedbackExists,
} from "../controllers/feedback.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create new feedback (donors only)
router.post("/", authorize(["donor"]), createFeedback);

// Check if feedback exists for donor/organization/cause (donors only)
router.get("/check", authorize(["donor"]), checkFeedbackExists);

// Get organization feedback
router.get("/organization/:organizationId", getOrganizationFeedback);

// Get organization feedback statistics
router.get("/organization/:organizationId/stats", getFeedbackStats);

// Update feedback status (organizations and admin)
router.patch(
	"/:feedbackId/status",
	authorize(["organization", "admin"]),
	updateFeedbackStatus
);

export default router;
