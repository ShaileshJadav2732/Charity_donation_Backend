import express from "express";
import { checkoutSession } from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/create-checkout-session", authenticate, checkoutSession);
export default router;
