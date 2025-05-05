import express from "express";
import {
	firebaseLogin,
	firebaseSignup,
} from "../controllers/auth/firebase-auth.controller";

const router = express.Router();

// Firebase authentication routes
router.post("/firebase/login", firebaseLogin);
router.post("/firebase/signup", firebaseSignup);

export default router;
