import express from "express";
import { getDonorData } from "../controllers/donor/donor.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";

const router = express.Router();

router.get("/dashboard", authenticate, authorizeRoles("donor"), getDonorData);

export default router;
