import express from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { getAdminData } from "../controllers/admin/admin.controller";
import { getDonorProfile } from "../controllers/donor/donor.controller";
import { getOrgData } from "../controllers/organization/org.controller";
const router = express.Router();

router.get("/admin-data", authenticate, authorizeRoles("admin"), getAdminData);
router.get("/org-data", authenticate, authorizeRoles("org"), getOrgData);
router.get(
  "/donor-data",
  authenticate,
  authorizeRoles("donor"),
  getDonorProfile
);
export default router;
