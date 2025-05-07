import express from "express";
import {
	firebaseLogin,
	firebaseSignup,
	getProfileStatus,
	validateFirebaseToken,
} from "../controllers/auth/firebase-auth.controller";

const router = express.Router();

// Firebase authentication routes
router.post("/firebase/login", firebaseLogin);
router.post("/firebase/signup", firebaseSignup);

// Profile status route - requires token validation
router.get("/profile-status", validateFirebaseToken, getProfileStatus);

export default router;
