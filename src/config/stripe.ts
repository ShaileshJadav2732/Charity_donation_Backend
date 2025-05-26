import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export const STRIPE_CONFIG = {
  currency: 'usd',
  automatic_payment_methods: {
    enabled: true,
  },
};
