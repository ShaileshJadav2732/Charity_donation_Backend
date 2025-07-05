import express from "express";
import {
	getDonorDashboardStats,
	getOrganizationDashboardStats,
} from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { Request, Response, NextFunction } from "express";

const router = express.Router();

router.use(authenticate);

// Create wrapper to handle AuthRequest controllers
const asyncHandler =
	(fn: any) => (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};

router.get(
	"/donor",
	authorize(["donor"]),
	asyncHandler(getDonorDashboardStats)
);

router.get(
	"/organization",
	authorize(["organization"]),
	asyncHandler(getOrganizationDashboardStats)
);

export default router;
