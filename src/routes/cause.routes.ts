import express from "express";
import {
   getCauses,
   getCauseById,
   createCause,
   updateCause,
   deleteCause,
   getOrganizationCauses,
   getDonorCauses,
} from "../controllers/cause.controller";
import { authenticate } from "../middleware/auth.middleware";
import { isOrganization, isDonor } from "../middleware/role.middleware";

const router = express.Router();

// Public routes
router.get("/", getCauses);
router.get("/:id", getCauseById);

// Protected routes
router.use(authenticate);

// Organization routes
router.post("/", isOrganization, createCause);
router.patch("/:id", isOrganization, updateCause);
router.delete("/:id", isOrganization, deleteCause);
router.get("/organization/:organizationId", getOrganizationCauses);

// Donor routes
router.get("/donor/supported", isDonor, getDonorCauses);

export default router; 