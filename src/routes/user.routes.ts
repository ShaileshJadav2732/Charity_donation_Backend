import express from "express";
import { registerUser } from "../controllers/user.controller";

const router = express.Router();

// Register route
router.post("/register", registerUser);

export default router;
