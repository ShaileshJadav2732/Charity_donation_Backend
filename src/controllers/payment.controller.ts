import { Request, Response } from "express";
import { stripe, STRIPE_CONFIG } from "../config/stripe";
import Cause from "../models/cause.model";
import Donation, {
	DonationStatus,
	DonationType,
} from "../models/donation.model";
import Organization from "../models/organization.model";
import { sendEmail } from "../utils/email";

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
		const {
			amount,
			cause,
			organization,
			campaign,
			description,
			contactPhone,
			contactEmail,
		}: CreatePaymentIntentRequest = req.body;

		if (!req.user?.id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		// Validate required fields
		if (!amount || !cause || !organization || !description) {
			return res.status(400).json({
				message: "Amount, cause, organization, and description are required",
			});
		}

		// Validate amount (minimum ₹50 for Stripe INR requirements)
		if (amount < 50) {
			return res.status(400).json({
				message: "Amount must be at least ₹50",
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

		// Check for existing pending payment intent for the same user and cause
		const existingPaymentIntents = await stripe.paymentIntents.list({
			limit: 50, // Increase limit to check more intents
		});

		const duplicateIntent = existingPaymentIntents.data.find(
			(intent) =>
				intent.metadata.donorId === req.user.id.toString() &&
				intent.metadata.causeId === cause &&
				intent.amount === Math.round(amount * 100) &&
				(intent.status === "requires_payment_method" ||
					intent.status === "requires_confirmation" ||
					intent.status === "requires_action")
		);

		if (duplicateIntent) {
			return res.status(200).json({
				clientSecret: duplicateIntent.client_secret,
				paymentIntentId: duplicateIntent.id,
			});
		}

		// Create payment intent with Stripe
		const paymentIntent = await stripe.paymentIntents.create({
			amount: Math.round(amount * 100), // Convert to paise (smallest unit of INR)
			currency: STRIPE_CONFIG.currency,
			automatic_payment_methods: STRIPE_CONFIG.automatic_payment_methods,
			metadata: {
				donorId: req.user.id.toString(),
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
		res.status(500).json({
			message: "Failed to create payment intent",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

export const confirmPayment = async (req: Request, res: Response) => {
	try {
		const { paymentIntentId, donationData }: ConfirmPaymentRequest = req.body;

		if (!req.user?.id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		if (!paymentIntentId) {
			return res.status(400).json({ message: "Payment intent ID is required" });
		}

		// Retrieve payment intent from Stripe
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

		// Accept both succeeded and processing statuses
		if (
			paymentIntent.status !== "succeeded" &&
			paymentIntent.status !== "processing"
		) {
			return res.status(400).json({
				message: `Payment status is ${paymentIntent.status}. Expected 'succeeded' or 'processing'.`,
				status: paymentIntent.status,
			});
		}

		// Verify the payment belongs to the authenticated user
		if (paymentIntent.metadata.donorId !== req.user.id.toString()) {
			return res.status(403).json({
				message: "Payment does not belong to authenticated user",
			});
		}

		// Check if donation already exists for this payment
		const existingDonation = await Donation.findOne({
			paymentIntentId: paymentIntentId,
		});

		if (existingDonation) {
			// Return the existing donation instead of error
			const populatedDonation = await Donation.findById(existingDonation._id)
				.populate("donor", "name email")
				.populate("organization", "name email")
				.populate("cause", "title")
				.populate("campaign", "title");

			return res.status(200).json({
				success: true,
				data: populatedDonation,
				message: "Donation already processed for this payment",
			});
		}

		// Create donation record
		const donation = new Donation({
			donor: req.user.id,
			organization: donationData.organization,
			campaign: donationData.campaign || undefined,
			cause: donationData.cause,
			type: DonationType.MONEY,
			status: DonationStatus.PENDING, // Start with PENDING status as per workflow
			amount: paymentIntent.amount / 100, // Convert from paise to rupees
			description: donationData.description,
			contactPhone: donationData.contactPhone,
			contactEmail: donationData.contactEmail,
			paymentIntentId: paymentIntentId,
			paymentStatus: paymentIntent.status, // Store Stripe payment status
			isPickup: false, // Monetary donations don't require pickup
		});

		await donation.save();

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
					DonationStatus.PENDING, // Changed to PENDING status
					donation.amount,
					undefined,
					undefined
				);
			} catch (emailError) {}
		}

		res.status(201).json({
			success: true,
			data: populatedDonation,
			message: "Payment confirmed and donation created successfully",
		});
	} catch (error) {
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
		return res.status(400).send("Webhook secret not configured");
	}

	let event: any;

	try {
		event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
	} catch (err) {
		return res.status(400).send(`Webhook Error: ${err}`);
	}

	// Handle the event
	switch (event.type) {
		case "payment_intent.succeeded":
			const paymentIntent = event.data.object;

			try {
				// First, try to update existing donation
				const existingDonation = await Donation.findOneAndUpdate(
					{ paymentIntentId: paymentIntent.id },
					{
						status: DonationStatus.APPROVED,
						paymentStatus: paymentIntent.status,
					},
					{ new: true }
				);

				if (existingDonation) {
				} else {
					const donation = new Donation({
						donor: paymentIntent.metadata.donorId,
						organization: paymentIntent.metadata.organizationId,
						campaign: paymentIntent.metadata.campaignId || undefined,
						cause: paymentIntent.metadata.causeId,
						type: DonationType.MONEY,
						status: DonationStatus.APPROVED, // Set to APPROVED since payment succeeded
						amount: paymentIntent.amount / 100, // Convert from paise to rupees
						description: paymentIntent.metadata.description,
						contactPhone: paymentIntent.metadata.contactPhone,
						contactEmail: paymentIntent.metadata.contactEmail,
						paymentIntentId: paymentIntent.id,
						paymentStatus: paymentIntent.status,
						isPickup: false,
					});

					await donation.save();

					// Update cause raised amount
					if (paymentIntent.metadata.causeId) {
						const cause = await Cause.findById(paymentIntent.metadata.causeId);
						if (cause) {
							cause.raisedAmount += donation.amount!;
							await cause.save();
						}
					}
				}
			} catch (updateError) {}
			break;

		case "payment_intent.payment_failed":
			const failedPayment = event.data.object;

			// Update donation status when payment fails
			try {
				const updatedDonation = await Donation.findOneAndUpdate(
					{ paymentIntentId: failedPayment.id },
					{ paymentStatus: failedPayment.status },
					{ new: true }
				);
			} catch (updateError) {}
			break;
	}

	res.json({ received: true });
};
