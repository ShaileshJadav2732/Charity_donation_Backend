import { Request, Response } from "express";
import { stripe, STRIPE_CONFIG } from "../config/stripe";
import Donation, {
	DonationStatus,
	DonationType,
} from "../models/donation.model";
import Cause from "../models/cause.model";
import Organization from "../models/organization.model";
import { sendEmail } from "../utils/email";
import { IUser } from "../types";

interface CreatePaymentIntentRequest {
	amount: number;
	cause: string;
	organization: string;
	campaign?: string;
	description: string;
	contactPhone: string;
	contactEmail: string;
}

interface ConfirmPaymentRequest {
	paymentIntentId: string;
	donationData: {
		cause: string;
		organization: string;
		campaign?: string;
		description: string;
		contactPhone: string;
		contactEmail: string;
	};
}

export const createPaymentIntent = async (req: Request, res: Response) => {
	try {
		console.log("=== CREATE PAYMENT INTENT REQUEST ===");
		console.log("Request body:", JSON.stringify(req.body, null, 2));
		console.log("User:", req.user?._id);

		const {
			amount,
			cause,
			organization,
			campaign,
			description,
			contactPhone,
			contactEmail,
		}: CreatePaymentIntentRequest = req.body;

		if (!req.user?._id) {
			console.log("ERROR: User not authenticated");
			return res.status(401).json({ message: "User not authenticated" });
		}

		// Validate required fields
		if (!amount || !cause || !organization || !description) {
			console.log("ERROR: Missing required fields:", {
				amount: !!amount,
				cause: !!cause,
				organization: !!organization,
				description: !!description,
			});
			return res.status(400).json({
				message: "Amount, cause, organization, and description are required",
			});
		}

		// Validate amount (minimum $1)
		if (amount < 1) {
			console.log("ERROR: Amount too small:", amount);
			return res.status(400).json({
				message: "Amount must be at least $1",
			});
		}

		// Verify cause and organization exist
		const causeDoc = await Cause.findById(cause);
		const orgDoc = await Organization.findById(organization);

		if (!causeDoc) {
			return res.status(404).json({ message: "Cause not found" });
		}

		if (!orgDoc) {
			return res.status(404).json({ message: "Organization not found" });
		}

		// Create payment intent with Stripe
		const paymentIntent = await stripe.paymentIntents.create({
			amount: Math.round(amount * 100), // Convert to cents
			currency: STRIPE_CONFIG.currency,
			automatic_payment_methods: STRIPE_CONFIG.automatic_payment_methods,
			metadata: {
				donorId: req.user._id.toString(),
				causeId: cause,
				organizationId: organization,
				campaignId: campaign || "",
				description,
				contactPhone,
				contactEmail,
			},
		});

		res.status(200).json({
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id,
		});
	} catch (error) {
		console.error("Error creating payment intent:", error);
		res.status(500).json({
			message: "Failed to create payment intent",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

export const confirmPayment = async (req: Request, res: Response) => {
	try {
		console.log("=== CONFIRM PAYMENT REQUEST ===");
		console.log("Request body:", JSON.stringify(req.body, null, 2));
		console.log("User:", req.user?._id);

		const { paymentIntentId, donationData }: ConfirmPaymentRequest = req.body;

		if (!req.user?._id) {
			console.log("ERROR: User not authenticated");
			return res.status(401).json({ message: "User not authenticated" });
		}

		if (!paymentIntentId) {
			console.log("ERROR: Payment intent ID missing");
			return res.status(400).json({ message: "Payment intent ID is required" });
		}

		console.log("Retrieving payment intent from Stripe:", paymentIntentId);
		// Retrieve payment intent from Stripe
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
		console.log("Payment intent status:", paymentIntent.status);
		console.log("Payment intent amount:", paymentIntent.amount);

		if (paymentIntent.status !== "succeeded") {
			console.log(
				"ERROR: Payment not succeeded, status:",
				paymentIntent.status
			);
			return res.status(400).json({
				message: "Payment has not been completed successfully",
				status: paymentIntent.status,
			});
		}

		// Verify the payment belongs to the authenticated user
		if (paymentIntent.metadata.donorId !== req.user._id.toString()) {
			return res.status(403).json({
				message: "Payment does not belong to authenticated user",
			});
		}

		// Check if donation already exists for this payment
		const existingDonation = await Donation.findOne({
			paymentIntentId: paymentIntentId,
		});

		if (existingDonation) {
			return res.status(400).json({
				message: "Donation already exists for this payment",
			});
		}

		console.log("Creating donation record...");
		// Create donation record
		const donation = new Donation({
			donor: req.user._id,
			organization: donationData.organization,
			campaign: donationData.campaign || undefined,
			cause: donationData.cause,
			type: DonationType.MONEY,
			status: DonationStatus.CONFIRMED, // Payment already succeeded
			amount: paymentIntent.amount / 100, // Convert from cents
			description: donationData.description,
			contactPhone: donationData.contactPhone,
			contactEmail: donationData.contactEmail,
			paymentIntentId: paymentIntentId,
			isPickup: false, // Monetary donations don't require pickup
		});

		console.log(
			"Donation data to save:",
			JSON.stringify(donation.toObject(), null, 2)
		);
		await donation.save();
		console.log("Donation saved successfully with ID:", donation._id);

		// Update cause raised amount
		const cause = await Cause.findById(donationData.cause);
		if (cause) {
			cause.raisedAmount += donation.amount!;
			await cause.save();
		}

		// Populate donation for response
		const populatedDonation = await Donation.findById(donation._id)
			.populate("donor", "name email")
			.populate("organization", "name email")
			.populate("cause", "title")
			.populate("campaign", "title");

		// Send email notification to organization
		const organizationData = populatedDonation?.organization as any;
		if (organizationData?.email) {
			try {
				await sendEmail(
					organizationData.email,
					donation._id.toString(),
					DonationStatus.CONFIRMED,
					donation.amount,
					undefined,
					undefined
				);
			} catch (emailError) {
				console.error("Failed to send email to organization:", emailError);
			}
		}

		res.status(201).json({
			success: true,
			data: populatedDonation,
			message: "Payment confirmed and donation created successfully",
		});
	} catch (error) {
		console.error("Error confirming payment:", error);
		res.status(500).json({
			message: "Failed to confirm payment",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
	const sig = req.headers["stripe-signature"] as string;
	const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

	if (!endpointSecret) {
		console.error("Stripe webhook secret not configured");
		return res.status(400).send("Webhook secret not configured");
	}

	let event;

	try {
		event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
	} catch (err) {
		console.error("Webhook signature verification failed:", err);
		return res.status(400).send(`Webhook Error: ${err}`);
	}

	// Handle the event
	switch (event.type) {
		case "payment_intent.succeeded":
			const paymentIntent = event.data.object;
			console.log("Payment succeeded:", paymentIntent.id);
			// Additional processing if needed
			break;
		case "payment_intent.payment_failed":
			const failedPayment = event.data.object;
			console.log("Payment failed:", failedPayment.id);
			// Handle failed payment
			break;
		default:
			console.log(`Unhandled event type ${event.type}`);
	}

	res.json({ received: true });
};
