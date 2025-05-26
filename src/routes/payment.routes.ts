import express from 'express';
import {
  createPaymentIntent,
  confirmPayment,
  handleStripeWebhook,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';

const router = express.Router();

// Create payment intent for donation
router.post(
  '/create-payment-intent',
  authenticate,
  authorize(['donor']),
  createPaymentIntent
);

// Confirm payment and create donation
router.post(
  '/confirm-payment',
  authenticate,
  authorize(['donor']),
  confirmPayment
);

// Stripe webhook endpoint (no auth required)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

export default router;
