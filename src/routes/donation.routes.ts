import express from "express";
import { createDonation } from "../controllers/donor/donation.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/create", authenticate, createDonation);

export default router;
