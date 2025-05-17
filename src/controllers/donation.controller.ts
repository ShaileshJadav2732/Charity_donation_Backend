import { Request, Response } from "express";
import { AuthRequest } from "../types";
import Donation, {
	DonationType,
	DonationStatus,
	IDonation,
} from "../models/donation.model";
import { sendEmail } from "../utils/email";
import { sendWhatsAppMessage } from "../utils/whatsapp";
import { validateObjectId } from "../utils/validation";

export const createDonation = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const {
			organization,
			campaign,
			cause,
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

		// Validate organization ID
		// if (!validateObjectId(organization)) {
		// 	return res.status(400).json({ message: "Invalid organization ID" });
		// }

		// Create new donation
		const donation = new Donation({
			donor: req.user._id,
			organization,
			campaign,
			cause,
			type,
			status: DonationStatus.PENDING,
			amount: type === DonationType.MONEY ? amount : undefined,
			description,
			quantity: type !== DonationType.MONEY ? quantity : undefined,
			unit: type !== DonationType.MONEY ? unit : undefined,
			scheduledDate: type !== DonationType.MONEY ? scheduledDate : undefined,
			scheduledTime: type !== DonationType.MONEY ? scheduledTime : undefined,
			pickupAddress,
			dropoffAddress,
			isPickup,
			contactPhone,
			contactEmail,
			notes,
		});

		await donation.save();

		res.status(201).json({
			success: true,
			data: donation,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error creating donation",
			error: error?.message || "Unknown error occurred",
		});
	}
};

export const getDonorDonations = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const { status, type, page = 1, limit = 10 } = req.query;
		const query: any = { donor: req.user._id };

		if (status) query.status = status;
		if (type) query.type = type;

		const donations = await Donation.find(query)
			.populate("organization", "name email phone")
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
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching donations",
			error: error?.message || "Unknown error occurred",
		});
	}
};

export const getDonationDetails = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const { donationId } = req.params;

		if (!validateObjectId(donationId)) {
			return res.status(400).json({ message: "Invalid donation ID" });
		}

		const donation = await Donation.findOne({
			_id: donationId,
			donor: req.user._id,
		}).populate("organization", "name email phone address");

		if (!donation) {
			return res.status(404).json({ message: "Donation not found" });
		}

		res.status(200).json({
			success: true,
			data: donation,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching donation details",
			error: error?.message || "Unknown error occurred",
		});
	}
};

export const updateDonationStatus = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const { donationId } = req.params;
		const { status } = req.body;

		if (!validateObjectId(donationId)) {
			return res.status(400).json({ message: "Invalid donation ID" });
		}

		const donation = await Donation.findOne({
			_id: donationId,
			donor: req.user._id,
		});

		if (!donation) {
			return res.status(404).json({ message: "Donation not found" });
		}

		// Only allow certain status updates from donor
		const allowedStatusUpdates = [DonationStatus.CANCELLED];

		if (!allowedStatusUpdates.includes(status)) {
			return res.status(400).json({
				message: "Invalid status update for donor",
			});
		}

		donation.status = status;
		await donation.save();

		res.status(200).json({
			success: true,
			data: donation,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error updating donation status",
			error: error?.message || "Unknown error occurred",
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

export const getDonorStats = async (req: Request, res: Response) => {
	try {
		// const donorId = req.user?._id;
		const donorId = req.user?._id;
		if (!donorId) {
			return res.status(401).json({ success: false, message: "Unauthorized" });
		}

		// Aggregate donations for the logged-in donor
		const stats = await Donation.aggregate([
			{
				$match: {
					donor: donorId,
					amount: { $ne: null }, // Exclude donations without a defined amount
				},
			},
			{
				$group: {
					_id: null,
					totalDonated: { $sum: "$amount" },
					averageDonation: { $avg: "$amount" },
					causeIds: { $addToSet: "$cause" },
				},
			},
			{
				$project: {
					_id: 0,
					totalDonated: 1,
					averageDonation: { $ifNull: ["$averageDonation", 0] },
					totalCauses: { $size: "$causeIds" },
				},
			},
		]);

		const result = stats[0] || {
			totalDonated: 0,
			averageDonation: 0,
			totalCauses: 0,
		};

		res.status(200).json({ success: true, data: result });
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Failed to fetch donor stats",
			error: error?.message || "Unknown error",
		});
	}
};
