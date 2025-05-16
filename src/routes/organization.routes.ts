import express from "express";
import {
   getOrganizations,
   getOrganizationById,
   getOrganizationByCauseId
} from "../controllers/organization.controller";

const router = express.Router();

// Public routes
router.get("/", getOrganizations);
router.get("/cause/:causeId", getOrganizationByCauseId);
router.get("/:id", getOrganizationById);

export default router; 