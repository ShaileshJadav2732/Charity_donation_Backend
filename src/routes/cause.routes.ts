import express from "express";
import { protect, authorize, verifyOrganization } from "../middleware/auth";
import { upload, handleMulterError } from "../middleware/upload";
import { UserRole } from "../types/enums";
import {
   createCause,
   getCauses,
   getCauseById as getCause,
   updateCause,
   deleteCause,
   getOrganizationCauses
} from "../controllers/cause.controller";

const router = express.Router();

// Public routes
router.get("/", getCauses);
router.get("/:id", getCause);

// Protected routes
router.use(protect);

// Organization routes
router.use(authorize(UserRole.ORGANIZATION, UserRole.ADMIN));
router.use(verifyOrganization);

// Cause management routes
router.route("/")
   .get(getOrganizationCauses)
   .post(upload.single("image"), handleMulterError, createCause);

router.route("/:id")
   .put(upload.single("image"), handleMulterError, updateCause)
   .delete(deleteCause);

export default router; 