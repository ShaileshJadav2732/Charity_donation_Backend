import express from "express";
import { getDonorProfile } from "../controllers/donor/donor.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { checkDonorProfileComplete } from "../middlewares/checkDonorProfile";
import { completeDonorProfile } from "../controllers/donor/donor.controller";
import { updateDonorProfile } from "./../controllers/donor/donor.controller";
const router = express.Router();

router.get(
  "/profile",
  authenticate,
  authorizeRoles("donor"),
  checkDonorProfileComplete,
  getDonorProfile
);
router.post("/complete-profile", authenticate, completeDonorProfile);
router.put(
  "/update-profile",
  authenticate,
  authorizeRoles("donor"),
  checkDonorProfileComplete,
  updateDonorProfile
);
export default router;
