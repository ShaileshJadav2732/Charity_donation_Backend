import express from "express";
import {
	createFeedback,
	getOrganizationFeedback,
	getFeedbackStats,
	updateFeedbackStatus,
} from "../controllers/feedback.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create new feedback (donors only)
router.post("/", authorize(["donor"]), createFeedback);

// Get organization feedback
router.get("/organization/:organizationId", getOrganizationFeedback);

// Get organization feedback statistics
router.get("/organization/:organizationId/stats", getFeedbackStats);

// Update feedback status (admin only)
router.patch("/:feedbackId/status", authorize(["admin"]), updateFeedbackStatus);

export default router;
