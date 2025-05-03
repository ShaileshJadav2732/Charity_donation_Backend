import express from "express";
import { firebaseAuth } from "../controllers/auth/firebase-auth.controller";

const router = express.Router();

router.post("/firebase", firebaseAuth);

export default router;
