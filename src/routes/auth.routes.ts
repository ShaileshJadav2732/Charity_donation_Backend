import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Auth routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-token", authController.verifyFirebaseToken);
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
