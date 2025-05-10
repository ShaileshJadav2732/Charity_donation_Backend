import { Request, Response } from "express";
import { AuthRequest } from "../types";
import Donation, {
	DonationType,
	DonationStatus,
} from "../models/donation.model";
import { sendEmail } from "../utils/email";
import { sendWhatsAppMessage } from "../utils/whatsapp";

export const createDonation = async (req: AuthRequest, res: Response) => {
	try {
		const {
			organization,
			type,
			amount,
			description,
			quantity,
			unit,
			scheduledDate,
			scheduledTime,
			pickupAddress,
			dropoffAddress,
			isPickup,
			contactPhone,
			contactEmail,
			notes,
		} = req.body;

		const donation = new Donation({
			donor: req.user?.id, // From auth middleware
			organization,
			type,
			amount,
			description,
			quantity,
			unit,
			scheduledDate,
			scheduledTime,
			pickupAddress,
			dropoffAddress,
			isPickup,
			contactPhone,
			contactEmail,
			notes,
		});

		await donation.save();

		// Send confirmation email to donor
		await sendEmail({
			to: contactEmail,
			subject: "Donation Confirmation",
			text: `Thank you for your donation! Your donation ID is ${donation._id}. We will contact you shortly for further details.`,
		});

		res.status(201).json({
			success: true,
			data: donation,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
};

export const getDonations = async (req: AuthRequest, res: Response) => {
	try {
		const { status, type, page = 1, limit = 10 } = req.query;
		const query: any = {};

		if (status) query.status = status;
		if (type) query.type = type;

		const donations = await Donation.find(query)
			.populate("donor", "name email")
			.populate("organization", "name email")
			.sort({ createdAt: -1 })
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit));

		const total = await Donation.countDocuments(query);

		res.status(200).json({
			success: true,
			data: donations,
			pagination: {
				total,
				page: Number(page),
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
};

export const getDonationById = async (req: AuthRequest, res: Response) => {
	try {
		const donation = await Donation.findById(req.params.id)
			.populate("donor", "name email")
			.populate("organization", "name email");

		if (!donation) {
			return res.status(404).json({
				success: false,
				error: "Donation not found",
			});
		}

		res.status(200).json({
			success: true,
			data: donation,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
};

export const updateDonationStatus = async (req: AuthRequest, res: Response) => {
	try {
		const { status, receiptImage } = req.body;
		const donation = await Donation.findById(req.params.id);

		if (!donation) {
			return res.status(404).json({
				success: false,
				error: "Donation not found",
			});
		}

		// Only organization can update status
		if (donation.organization.toString() !== req.user?.id) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to update this donation",
			});
		}

		donation.status = status;
		if (receiptImage) donation.receiptImage = receiptImage;
		if (status === DonationStatus.CONFIRMED) {
			donation.confirmationDate = new Date();
		}

		await donation.save();

		// Send notifications
		if (status === DonationStatus.RECEIVED) {
			await sendEmail({
				to: donation.contactEmail,
				subject: "Donation Received",
				text: `Your donation has been received. Thank you for your generosity!`,
			});

			await sendWhatsAppMessage({
				to: donation.contactPhone,
				message: `Your donation has been received. Thank you for your generosity!`,
			});
		}

		res.status(200).json({
			success: true,
			data: donation,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
};

export const cancelDonation = async (req: AuthRequest, res: Response) => {
	try {
		const donation = await Donation.findById(req.params.id);

		if (!donation) {
			return res.status(404).json({
				success: false,
				error: "Donation not found",
			});
		}

		// Only donor or organization can cancel
		if (
			donation.donor.toString() !== req.user?.id &&
			donation.organization.toString() !== req.user?.id
		) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to cancel this donation",
			});
		}

		donation.status = DonationStatus.CANCELLED;
		await donation.save();

		// Send cancellation notification
		await sendEmail({
			to: donation.contactEmail,
			subject: "Donation Cancelled",
			text: `Your donation has been cancelled. If you have any questions, please contact us.`,
		});

		res.status(200).json({
			success: true,
			data: donation,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
};
