import express from "express";
import { getOrgData } from "../controllers/organization/org.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";

const router = express.Router();

router.get(
  "/dashboard",
  authenticate,
  authorizeRoles("organization"),
  getOrgData
);

export default router;
