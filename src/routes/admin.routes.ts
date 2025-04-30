import express from "express";
import { getAdminData } from "../controllers/admin/admin.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";

const router = express.Router();

router.get("/dashboard", authenticate, authorizeRoles("admin"), getAdminData);

export default router;
