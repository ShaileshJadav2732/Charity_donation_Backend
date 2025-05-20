import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause from "../models/cause.model";
import Donation, {
	DonationStatus,
	DonationType,
} from "../models/donation.model";
import Organization from "../models/organization.model";
import { AuthRequest } from "../types";
import { sendEmail } from "../utils/email";
import { validateObjectId } from "../utils/validation";
import { sendDonationStatusNotification } from "../utils/notification";
import { IUser } from "../types";

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
			pickupAddress: type !== DonationType.MONEY ? pickupAddress : undefined,
			dropoffAddress: type !== DonationType.MONEY ? dropoffAddress : undefined,
			isPickup: type !== DonationType.MONEY ? isPickup : undefined,
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

// export const updateDonationStatus = async (req: Request, res: Response) => {
// 	try {
// 		if (!req.user?._id) {
// 			return res.status(401).json({ message: "User not authenticated" });
// 		}

// 		const { donationId } = req.params;
// 		const { status } = req.body;

// 		if (!validateObjectId(donationId)) {
// 			return res.status(400).json({ message: "Invalid donation ID" });
// 		}

// 		// Find donation and check if user has permission
// 		const donation = await Donation.findOne({
// 			_id: donationId,
// 			$or: [{ donor: req.user._id }, { organization: req.user._id }],
// 		}).populate<{ donor: IUser }>("donor", "name email");

// 		if (!donation) {
// 			return res.status(404).json({ message: "Donation not found" });
// 		}

// 		// If user is donor, only allow cancellation
// 		if (donation.donor.toString() === req.user._id.toString()) {
// 			if (status !== DonationStatus.CANCELLED) {
// 				return res.status(403).json({
// 					message: "Donors can only cancel donations",
// 				});
// 			}
// 		}

// 		// If user is organization, allow all status updates except CANCELLED
// 		if (donation.organization.toString() === req.user._id.toString()) {
// 			if (status === DonationStatus.CANCELLED) {
// 				return res.status(403).json({
// 					message: "Organizations cannot cancel donations",
// 				});
// 			}
// 		}

// 		const oldStatus = donation.status;
// 		donation.status = status;
// 		await donation.save();

// 		// Send notification to donor about status change
// 		if (
// 			donation.donor &&
// 			typeof donation.donor === "object" &&
// 			"email" in donation.donor
// 		) {
// 			await sendDonationStatusNotification(
// 				donation.donor.email as string,
// 				donationId,
// 				status,
// 				donation.donor.name
// 			);
// 		}

// 		res.status(200).json({
// 			success: true,
// 			data: donation,
// 			message: `Donation status updated from ${oldStatus} to ${status}`,
// 		});
// 	} catch (error: any) {
// 		res.status(500).json({
// 			success: false,
// 			message: "Error updating donation status",
// 			error: error?.message || "Unknown error occurred",
// 		});
// 	}
// };

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
		const stats = await Cause.aggregate([
			{
				$group: {
					_id: null,
					totalDonated: { $sum: "$raisedAmount" },
					averageDonation: { $avg: "$raisedAmount" },
					totalCauses: { $sum: 1 },
				},
			},
			{
				$project: {
					_id: 0,
					totalDonated: 1,
					averageDonation: { $round: ["$averageDonation", 2] },
					totalCauses: 1,
				},
			},
		]);

		// If no causes exist, return zeros
		const response = stats[0] || {
			totalDonated: 0,
			averageDonation: 0,
			totalCauses: 0,
		};

		res.status(200).json({
			success: true,
			data: response,
		});
	} catch (error) {
		console.error("Failed to fetch stats:", error);
		res.status(500).json({
			success: false,
			message: "Something went wrong",
		});
	}
};

export const findOrganizationPendingDonations = async (
	req: Request,
	res: Response
) => {
	try {
		// Get organization ID from request params
		const { organizationId } = req.params;
		console.log("Backend - Received organizationId:", organizationId);
		console.log("Backend - Full request params:", req.params);
		console.log("Backend - Query parameters:", req.query);

		// Verify the organization ID is valid
		if (!organizationId) {
			return res.status(400).json({
				success: false,
				message: "Organization ID is required",
			});
		}

		// Parse query parameters
		const status = (req.query.status as string)?.toUpperCase() || "PENDING";
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;

		console.log("Backend - Query parameters after parsing:", {
			status,
			page,
			limit,
		});

		// Create query based on inputs
		const donations = await Donation.find({
			organization: organizationId,
			status: status,
		})
			.populate("donor", "email phone")
			.populate("cause", "title")
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit);

		console.log("Backend - Found donations:", donations);

		// Get total count for pagination
		const total = await Donation.countDocuments({
			organization: organizationId,
			status: status,
		});

		console.log(
			`Backend - Found ${donations.length} donations out of ${total} total`
		);

		// Return the results
		res.status(200).json({
			success: true,
			data: donations,
			pagination: {
				total,
				page,
				pages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Error finding organization donations:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch organization donations",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

export const updateDonationStatus = async (req: Request, res: Response) => {
	try {
		// Check if user is authenticated
		if (!req.user?._id) {
			return res.status(401).json({
				success: false,
				message: "User not authenticated",
			});
		}

		// Get donation ID from request params
		const { donationId } = req.params;
		const { status } = req.body;

		// Validate input
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res.status(400).json({
				success: false,
				message: "Valid donation ID is required",
			});
		}

		if (!status || !Object.values(DonationStatus).includes(status)) {
			return res.status(400).json({
				success: false,
				message: "Valid status is required",
			});
		}

		// Prevent organizations from cancelling donations
		if (status === DonationStatus.CANCELLED) {
			return res.status(403).json({
				success: false,
				message: "Organizations cannot cancel donations",
			});
		}

		// Find the donation
		const donation = await Donation.findById(donationId)
			.populate<{ donor: IUser }>("donor", "name email")
			.populate("cause", "title")
			.populate("organization", "_id name"); // Populate organization to verify ownership

		console.log("donnnnnnnnation", donation?.organization._id);
		if (!donation) {
			return res.status(404).json({
				success: false,
				message: "Donation not found",
			});
		}

		// Verify organization ownership (assuming user is linked to organization)
		const organization = await Organization.findOne({
			_id: donation?.organization._id,
		});

		console.log("ooooooooo", organization);
		if (!organization) {
			return res.status(403).json({
				success: false,
				message: "You do not have permission to update this donation",
			});
		}

		// Check if the current status is PENDING
		if (donation.status !== DonationStatus.PENDING) {
			return res.status(400).json({
				success: false,
				message: "Only pending donations can be updated",
			});
		}

		// Update donation status
		donation.status = status;

		// // Add confirmation date if status is COMPLETED
		// if (status === DonationStatus.COMPLETED) {
		// 	donation.confirmationDate = new Date();
		// }

		// Save the updated donation
		await donation.save();

		// Return the updated donation
		res.status(200).json({
			success: true,
			data: donation,
			message: `Donation status updated to ${status}`,
		});
	} catch (error: any) {
		console.error("Error updating donation status:", error);
		res.status(500).json({
			success: false,
			message: "Error updating donation status",
			error: error?.message || "Unknown error occurred",
		});
	}
};
