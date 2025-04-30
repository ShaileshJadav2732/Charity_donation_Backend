import express from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { getAdminData, getOrgData } from "../controllers/role.controller";

const router = express.Router();

router.get("/admin-data", authenticate, authorizeRoles("admin"), getAdminData);
router.get("/org-data", authenticate, authorizeRoles("org"), getOrgData);

export default router;
