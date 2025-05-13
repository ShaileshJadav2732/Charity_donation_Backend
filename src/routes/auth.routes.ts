import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  register,
  checkUserExists,
  logout,
} from "./../controllers/auth.controller";

const router = Router();

// Auth routes
router.post("/signup", register);
router.get("/check", checkUserExists);
router.post("/logout", logout);
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
