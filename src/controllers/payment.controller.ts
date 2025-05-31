import { Request, Response } from "express";
import { STRIPE_CONFIG } from "../config/stripe";
import Cause from "../models/cause.model";
import Donation, {
	DonationStatus,
	DonationType,
} from "../models/donation.model";
import Organization from "../models/organization.model";
import { sendEmail } from "../utils/email";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2023-10-16",
});

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

		// Update cause raised amount only if not already updated
		const cause = await Cause.findById(donationData.cause);
		if (cause) {
			// Check if this donation amount was already added to avoid double counting
			const existingDonationAmount = await Donation.findOne({
				cause: donationData.cause,
				paymentIntentId: donationData.paymentIntentId,
				status: { $in: [DonationStatus.APPROVED, DonationStatus.CONFIRMED] },
			});

			if (!existingDonationAmount) {
				cause.raisedAmount += donation.amount!;
				await cause.save();
				console.log(
					`Updated cause ${cause._id} raisedAmount by ${donation.amount}`
				);
			}
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

// export const handleStripeWebhook = async (req: Request, res: Response) => {
// 	const sig = req.headers["stripe-signature"] as string;
// 	const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// 	if (!endpointSecret) {
// 		return res.status(400).send("Webhook secret not configured");
// 	}

// 	let event: any;

// 	try {
// 		event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
// 	} catch (err) {
// 		return res.status(400).send(`Webhook Error: ${err}`);
// 	}

// 	// Handle the event
// 	switch (event.type) {
// 		case "payment_intent.succeeded":
// 			const paymentIntent = event.data.object;

// 			try {
// 				// First, try to update existing donation
// 				const existingDonation = await Donation.findOneAndUpdate(
// 					{ paymentIntentId: paymentIntent.id },
// 					{
// 						status: DonationStatus.APPROVED,
// 						paymentStatus: paymentIntent.status,
// 					},
// 					{ new: true }
// 				);

// 				if (existingDonation) {
// 					// Update cause raised amount for existing donation
// 					if (existingDonation.cause && existingDonation.amount) {
// 						const cause = await Cause.findById(existingDonation.cause);
// 						if (cause) {
// 							cause.raisedAmount += existingDonation.amount;
// 							await cause.save();
// 							console.log(
// 								`Updated cause ${cause._id} raisedAmount by ${existingDonation.amount} via webhook`
// 							);
// 						}
// 					}
// 				} else {
// 					const donation = new Donation({
// 						donor: paymentIntent.metadata.donorId,
// 						organization: paymentIntent.metadata.organizationId,
// 						campaign: paymentIntent.metadata.campaignId || undefined,
// 						cause: paymentIntent.metadata.causeId,
// 						type: DonationType.MONEY,
// 						status: DonationStatus.APPROVED, // Set to APPROVED since payment succeeded
// 						amount: paymentIntent.amount / 100, // Convert from paise to rupees
// 						description: paymentIntent.metadata.description,
// 						contactPhone: paymentIntent.metadata.contactPhone,
// 						contactEmail: paymentIntent.metadata.contactEmail,
// 						paymentIntentId: paymentIntent.id,
// 						paymentStatus: paymentIntent.status,
// 						isPickup: false,
// 					});

// 					await donation.save();

// 					// Update cause raised amount
// 					if (paymentIntent.metadata.causeId) {
// 						const cause = await Cause.findById(paymentIntent.metadata.causeId);
// 						if (cause) {
// 							cause.raisedAmount += donation.amount!;
// 							await cause.save();
// 							console.log(
// 								`Updated cause ${cause._id} raisedAmount by ${donation.amount} via webhook`
// 							);
// 						}
// 					}
// 				}
// 			} catch (updateError) {}
// 			break;

// 		case "payment_intent.payment_failed":
// 			const failedPayment = event.data.object;

// 			// Update donation status when payment fails
// 			try {
// 				const updatedDonation = await Donation.findOneAndUpdate(
// 					{ paymentIntentId: failedPayment.id },
// 					{ paymentStatus: failedPayment.status },
// 					{ new: true }
// 				);
// 			} catch (updateError) {}
// 			break;
// 	}

// 	res.json({ received: true });
// };

// export const handleStripeWebhook = async (req: Request, res: Response) => {
// 	console.log("webook route hit0");
// 	const sig = req.headers["stripe-signature"] as string;
// 	console.log("sig", sig);
// 	let event;

// 	try {
// 		event = stripe.webhooks.constructEvent(
// 			req.body,
// 			sig,
// 			process.env.STRIPE_WEBHOOK_SECRET
// 		);
// 	} catch (err) {
// 		console.error("Webhook signature verification failed.", err);
// 		return res.sendStatus(400);
// 	}

// 	if (event.type === "checkout.session.completed") {
// 		const session = event.data.object as Stripe.Checkout.Session;

// 		// ✅ Extract required data
// 		const donorId = session.metadata?.donorId;
// 		const amountPaid = (session.amount_total ?? 0) / 100; // ₹
// 		const donorEmail = session.customer_details?.email || "unknown";
// 		const paidTime = session.created
// 			? new Date(session.created * 1000).toISOString() // readable date
// 			: new Date().toISOString();

// 		console.log("✔️ Payment received:");
// 		console.log("Donor ID:", donorId);
// 		console.log("Email:", donorEmail);
// 		console.log("Amount (INR):", amountPaid);
// 		console.log("Paid Time:", paidTime);

// 		// TODO: Save payment data in DB or perform related actions
// 		// await savePayment({ donorId, donorEmail, amountPaid, paidTime });
// 	}

// 	return res.sendStatus(200);
// };

export const handleStripeWebhook = async (req: Request, res: Response) => {
	console.log("🔔 Stripe webhook hit");

	const sig = req.headers["stripe-signature"] as string;
	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET!
		);
		console.log(req.body);
	} catch (err) {
		console.error("❌ Webhook signature verification failed.", err);
		return res.sendStatus(400);
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		console.log("data===========", session.metadata);
		const donorId = session.metadata?.donorId;
		const organizationId = session.metadata?.organizationId;
		const causeId = session.metadata?.causeId;
		const campaignId = session.metadata?.campaignId;
		const contactEmail =
			session.customer_details?.email || session.metadata?.contactEmail || "";
		const contactPhone = session.metadata?.contactPhone || "";
		const description = session.metadata?.description || "";
		const paymentIntentId = session.payment_intent as string;
		const paymentStatus = session.payment_status;
		const amount = (session.amount_total ?? 0) / 100; // convert to rupees

		console.log("aaaaaaaaaa", causeId);

		try {
			// ✅ Check if donation with this paymentIntentId already exists
			let existingDonation = await Donation.findOne({ paymentIntentId });

			if (existingDonation) {
				existingDonation.status = DonationStatus.APPROVED;
				existingDonation.paymentStatus = paymentStatus;
				await existingDonation.save();
				console.log("⚠️ Existing donation updated");
			} else {
				// ✅ Create new donation
				const newDonation = await Donation.create({
					donor: donorId,
					organization: organizationId,
					campaign: campaignId || undefined,
					cause: causeId,
					type: DonationType.MONEY,
					status: DonationStatus.APPROVED,
					amount,
					description,
					contactPhone,
					contactEmail,
					paymentIntentId,
					paymentStatus,
					isPickup: false,
				});

				console.log("✅ Donation saved:", newDonation);

				// ✅ Update cause raised amount
				if (causeId && amount) {
					const cause = await Cause.findById(causeId);
					if (cause) {
						cause.raisedAmount += amount;
						await cause.save();
						console.log(
							`📈 Cause ${causeId} raised amount updated by ₹${amount}`
						);
					}
				}
			}
		} catch (err) {
			console.error("❌ Failed to process payment data:", err);
		}
	}

	return res.sendStatus(200);
};

export const checkoutSession = async (req: Request, res: Response) => {
	console.log("here");
	const {
		amount,
		organizationId,
		causeId,
		campaignId,
		description,
		contactPhone,
		contactEmail,
	} = req.body;
	// console.log("checkoutsession dtaa", req.body);
	if (!amount || amount <= 0)
		return res.status(400).json({ error: "Invalid amount" });

	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			mode: "payment",
			line_items: [
				{
					price_data: {
						currency: "inr",
						unit_amount: Math.round(amount * 100), // cents
						product_data: {
							name: "Donation",
						},
					},
					quantity: 1,
				},
			],
			success_url: `http://localhost:3000/dashboard/donations`,
			cancel_url: `http://localhost:3000/cancel`,
			metadata: {
				organizationId,
				causeId,
				campaignId: campaignId || "", // optional
				description: description || "",
				contactPhone: contactPhone || "",
				contactEmail: contactEmail || "",
			},
		});

		res.json({ url: session.url });
	} catch (err: any) {
		console.error(err);
		res.status(500).json({ error: "Something went wrong" });
	}
};
