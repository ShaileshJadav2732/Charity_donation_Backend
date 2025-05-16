import express from "express";
import {
   getOrganizationAnalyticsOverview,
   getCauseAnalytics,
   getDonorAnalytics
} from "../controllers/analytics.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = express.Router();

// All routes are protected and require organization role
router.use(authenticate);
router.use(authorize(["organization"]));

// Routes
router.get("/overview", getOrganizationAnalyticsOverview);
router.get("/causes/:causeId", getCauseAnalytics);
router.get("/donors", getDonorAnalytics);

export default router; 