import { Request, Response } from "express";
import Stripe from "stripe";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import { NotificationType } from "../types/notification";
import { NotificationService } from "../services/notificationService";
import { sendEmail } from "../utils/email";
import { DonationStatus, DonationType } from "../types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2023-10-16",
});

// Helper function to send notifications via webhook
const sendWebhookNotifications = async (
	req: Request,
	donation: any,
	organizationId: string,
	donorId: string,
	causeId: string,
	amount: number
) => {
	try {
		// Get populated data
		const populatedDonation = await Donation.findById(donation._id)
			.populate("donor", "firstName lastName email")
			.populate("organization", "name email userId")
			.populate("cause", "title");

		const organizationData = populatedDonation?.organization as any;
		const donorData = populatedDonation?.donor as any;
		const causeData = populatedDonation?.cause as any;

		if (organizationData && donorData) {
			// Get Socket.IO instance
			const io = req.app.get("io");
			const notificationService = new NotificationService(io);

			// Send real-time notification to organization
			await notificationService.createAndEmitNotification({
				recipient: organizationData.userId.toString(),
				type: NotificationType.DONATION_RECEIVED,
				title: "Payment Confirmed - New Donation!",
				message: `Payment confirmed! You received ₹${amount} from ${donorData.firstName} ${donorData.lastName} for ${causeData?.title || "your cause"}.`,
				data: {
					donationId: donation._id.toString(),
					amount: amount,
					donorName: `${donorData.firstName} ${donorData.lastName}`,
					causeName: causeData?.title,
					status: DonationStatus.CONFIRMED,
					paymentConfirmed: true,
				},
			});

			// Send email notifications
			await sendEmail(
				organizationData.email,
				donation._id.toString(),
				DonationStatus.APPROVED,
				amount
			);
		}
	} catch (error) {
		console.error(" Failed to send webhook notifications:", error);
	}
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
	const sig = req.headers["stripe-signature"] as string;
	let event: Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET
		);
		console.log("---------------", req.body);
	} catch (err) {
		console.error("Webhook signature verification failed.", err);
		return res.sendStatus(400);
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;

		const organizationId = session.metadata?.organizationId;
		const causeId = session.metadata?.causeId;
		const campaignId = session.metadata?.campaignId;
		const donorId = session.metadata?.donorId;
		const contactEmail =
			session.customer_details?.email || session.metadata?.contactEmail || "";
		const contactPhone = session.metadata?.contactPhone || "";
		const description = session.metadata?.description || "";
		const paymentIntentId = session.payment_intent as string;
		const paymentStatus = session.payment_status;
		const amount = (session.amount_total ?? 0) / 100; // convert to rupees

		try {
			// Check if donation with this paymentIntentId already exists
			let existingDonation = await Donation.findOne({ paymentIntentId });
			let donation: any;

			if (existingDonation) {
				existingDonation.status = DonationStatus.APPROVED;
				existingDonation.paymentStatus = paymentStatus;
				await existingDonation.save();
				donation = existingDonation;
			} else {
				console.log("Creating new donation with data:", {
					donor: donorId,
					organization: organizationId,
					campaign: campaignId || undefined,
					cause: causeId,
					amount,
					paymentIntentId,
				});

				//  Create new donation
				donation = await Donation.create({
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
				console.log("_++_+_+_+__+_+_+_+_+_", donation);
				// Update cause raised amount
				if (causeId && amount) {
					const cause = await Cause.findById(causeId);
				}
			}

			// Send notifications and emails via webhook
			await sendWebhookNotifications(
				req,
				donation,
				organizationId,
				donorId,
				causeId,
				amount
			);
		} catch (err) {
			console.error(" Failed to process payment data:", err);
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

	if (!req.user?.id) {
		return res.status(401).json({ message: "User not authenticated" });
	}

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
			success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/donations?payment=success`,
			cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard/donations?payment=cancelled`,
			metadata: {
				organizationId,
				donorId: req.user.id.toString(), // Use authenticated user's ID
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
