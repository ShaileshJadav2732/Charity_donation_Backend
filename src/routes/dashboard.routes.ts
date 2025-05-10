import express from "express";
import { getDonorDashboardStats } from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Get donor dashboard stats
router.get("/donor", authenticate, getDonorDashboardStats);

export default router;
