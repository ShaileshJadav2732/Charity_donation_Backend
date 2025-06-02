import express from "express";
import {
	getDonorDashboardStats,
	getOrganizationDashboardStats,
} from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get donor dashboard stats
router.get(
	"/donor",
	authorize(["donor"]),
	getDonorDashboardStats as express.RequestHandler
);

// Get organization dashboard stats
router.get(
	"/organization",
	authorize(["organization"]),
	getOrganizationDashboardStats as express.RequestHandler
);

export default router;
