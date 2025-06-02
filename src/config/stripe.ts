import Stripe from "stripe";

// Validate required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
	throw new Error("STRIPE_SECRET_KEY is required");
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
	console.warn("STRIPE_WEBHOOK_SECRET is not configured - webhooks will not work");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
	apiVersion: "2023-10-16",
});

export const STRIPE_CONFIG = {
	currency: "inr", // INR currency for Indian Rupee (₹)
	automatic_payment_methods: {
		enabled: true,
	},
};
