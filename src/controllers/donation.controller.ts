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
import Notification, { NotificationType } from "../models/notification.model";
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

		// Store the previous status before updating
		const previousStatus = donation.status;

		// Update status to cancelled
		donation.status = DonationStatus.CANCELLED;

		// If the donation was previously confirmed or received and it's a monetary donation,
		// subtract the amount from the cause's raisedAmount
		if (
			(previousStatus === DonationStatus.CONFIRMED || previousStatus === DonationStatus.RECEIVED) &&
			donation.type === DonationType.MONEY &&
			donation.amount &&
			donation.cause
		) {
			// Find the cause and update its raisedAmount
			const causeId = donation.cause;
			const cause = await Cause.findById(causeId);
			if (cause) {
				// Ensure raisedAmount doesn't go below 0
				cause.raisedAmount = Math.max(0, cause.raisedAmount - donation.amount);
				await cause.save();
				console.log(`Updated cause ${cause._id} raisedAmount to ${cause.raisedAmount} after cancellation`);
			}
		}

		await donation.save();

		// Send cancellation notification to the organization
		if (donation.organization) {
			try {
				await Notification.create({
					recipient: donation.organization,
					type: NotificationType.DONATION_STATUS_UPDATED,
					title: "Donation Cancelled",
					message: `A donation (ID: ${donation._id}) has been cancelled.`,
					isRead: false,
					data: { donationId: donation._id, status: DonationStatus.CANCELLED },
				});
			} catch (notificationError) {
				console.error(`Failed to create cancellation notification: ${notificationError}`);
			}
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

export const getDonorStats = async (req: Request, res: Response) => {
	try {
		// Get user ID if authenticated
		const userId = req.user?._id;

		// Create base match condition for confirmed/received donations
		const baseMatchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
		};

		// If user is authenticated, filter by their donations
		if (userId) {
			baseMatchCondition.donor = userId;
		}

		// Match condition for monetary donations
		const moneyMatchCondition = {
			...baseMatchCondition,
			type: DonationType.MONEY
		};

		// Get monetary donation statistics
		const moneyDonationStats = await Donation.aggregate([
			{
				$match: moneyMatchCondition
			},
			{
				$group: {
					_id: null,
					totalDonated: { $sum: "$amount" },
					averageDonation: { $avg: "$amount" },
					donationCount: { $sum: 1 }
				}
			},
			{
				$project: {
					_id: 0,
					totalDonated: 1,
					averageDonation: { $round: ["$averageDonation", 2] },
					donationCount: 1
				}
			}
		]);

		// Get count of unique causes supported (for all donation types)
		const causesSupported = await Donation.aggregate([
			{
				$match: baseMatchCondition
			},
			{
				$group: {
					_id: "$cause"
				}
			},
			{
				$group: {
					_id: null,
					totalCauses: { $sum: 1 }
				}
			},
			{
				$project: {
					_id: 0,
					totalCauses: 1
				}
			}
		]);

		// Get item donation statistics
		const itemMatchCondition = {
			...baseMatchCondition,
			type: { $ne: DonationType.MONEY }
		};

		const itemDonationStats = await Donation.aggregate([
			{
				$match: itemMatchCondition
			},
			{
				$group: {
					_id: "$type",
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" }
				}
			},
			{
				$project: {
					_id: 0,
					type: "$_id",
					count: 1,
					totalQuantity: 1
				}
			}
		]);

		// Get total item donations count
		const totalItemDonations = await Donation.countDocuments(itemMatchCondition);

		// Combine the results
		const response = {
			monetary: {
				totalDonated: moneyDonationStats[0]?.totalDonated || 0,
				averageDonation: moneyDonationStats[0]?.averageDonation || 0,
				donationCount: moneyDonationStats[0]?.donationCount || 0
			},
			items: {
				totalDonations: totalItemDonations,
				byType: itemDonationStats
			},
			totalCauses: causesSupported[0]?.totalCauses || 0
		};

		console.log("Donor stats calculated:", response);

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

export const getItemDonationTypeAnalytics = async (req: Request, res: Response) => {
	try {
		const { type } = req.params;

		// Validate donation type
		if (!type || !Object.values(DonationType).includes(type as DonationType)) {
			return res.status(400).json({
				success: false,
				message: "Valid donation type is required"
			});
		}

		// Get user ID if authenticated
		const userId = req.user?._id;

		// Create match condition for confirmed/received donations of the specified type
		const matchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			type: type
		};

		// If user is authenticated, filter by their donations
		if (userId) {
			matchCondition.donor = userId;
		}

		// Get detailed donation information
		const donations = await Donation.find(matchCondition)
			.populate("cause", "title")
			.populate("organization", "name")
			.sort({ createdAt: -1 })
			.limit(20)
			.lean(); // Use lean() to get plain JavaScript objects

		// Get statistics for this donation type
		const stats = await Donation.aggregate([
			{
				$match: matchCondition
			},
			{
				$group: {
					_id: null,
					totalDonations: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
					avgQuantity: { $avg: "$quantity" }
				}
			},
			{
				$project: {
					_id: 0,
					totalDonations: 1,
					totalQuantity: 1,
					avgQuantity: { $round: ["$avgQuantity", 2] }
				}
			}
		]);

		// Get monthly trend
		const today = new Date();
		const sixMonthsAgo = new Date(today);
		sixMonthsAgo.setMonth(today.getMonth() - 5);

		const monthlyTrend = await Donation.aggregate([
			{
				$match: {
					...matchCondition,
					createdAt: { $gte: sixMonthsAgo }
				}
			},
			{
				$group: {
					_id: {
						year: { $year: "$createdAt" },
						month: { $month: "$createdAt" }
					},
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" }
				}
			},
			{
				$project: {
					_id: 0,
					year: "$_id.year",
					month: "$_id.month",
					count: 1,
					totalQuantity: 1
				}
			},
			{
				$sort: { year: 1, month: 1 }
			}
		]);

		// Get top causes for this donation type
		const topCauses = await Donation.aggregate([
			{
				$match: matchCondition
			},
			{
				$lookup: {
					from: "causes",
					localField: "cause",
					foreignField: "_id",
					as: "causeInfo"
				}
			},
			{
				$unwind: "$causeInfo"
			},
			{
				$group: {
					_id: "$cause",
					causeName: { $first: "$causeInfo.title" },
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" }
				}
			},
			{
				$project: {
					_id: 0,
					causeId: "$_id",
					causeName: 1,
					count: 1,
					totalQuantity: 1
				}
			},
			{
				$sort: { count: -1 }
			},
			{
				$limit: 5
			}
		]);

		// Combine the results
		const response = {
			type,
			stats: stats[0] || { totalDonations: 0, totalQuantity: 0, avgQuantity: 0 },
			recentDonations: donations.map(d => ({
				id: d._id,
				description: d.description,
				quantity: d.quantity,
				unit: d.unit,
				cause: d.cause ? {
					id: (d.cause as any)._id,
					title: (d.cause as any).title
				} : null,
				organization: d.organization ? {
					id: (d.organization as any)._id,
					name: (d.organization as any).name
				} : null,
				createdAt: d.createdAt
			})),
			monthlyTrend,
			topCauses
		};

		res.status(200).json({
			success: true,
			data: response
		});
	} catch (error) {
		console.error(`Failed to fetch ${req.params.type} donation analytics:`, error);
		res.status(500).json({
			success: false,
			message: "Something went wrong"
		});
	}
};

export const getItemDonationAnalytics = async (req: Request, res: Response) => {
	try {
		// Get user ID if authenticated
		const userId = req.user?._id;

		// Create base match condition for confirmed/received item donations
		const matchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			type: { $ne: DonationType.MONEY }
		};

		// If user is authenticated, filter by their donations
		if (userId) {
			matchCondition.donor = userId;
		}

		// Get item donation statistics by type
		const donationsByType = await Donation.aggregate([
			{
				$match: matchCondition
			},
			{
				$group: {
					_id: "$type",
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
					items: {
						$push: {
							id: "$_id",
							description: "$description",
							quantity: "$quantity",
							unit: "$unit",
							status: "$status",
							createdAt: "$createdAt"
						}
					}
				}
			},
			{
				$project: {
					_id: 0,
					type: "$_id",
					count: 1,
					totalQuantity: 1,
					items: { $slice: ["$items", 5] } // Limit to 5 most recent items per type
				}
			},
			{
				$sort: { count: -1 }
			}
		]);

		// Get monthly trend of item donations
		const today = new Date();
		const sixMonthsAgo = new Date(today);
		sixMonthsAgo.setMonth(today.getMonth() - 5);

		const monthlyTrend = await Donation.aggregate([
			{
				$match: {
					...matchCondition,
					createdAt: { $gte: sixMonthsAgo }
				}
			},
			{
				$group: {
					_id: {
						year: { $year: "$createdAt" },
						month: { $month: "$createdAt" },
						type: "$type"
					},
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" }
				}
			},
			{
				$project: {
					_id: 0,
					year: "$_id.year",
					month: "$_id.month",
					type: "$_id.type",
					count: 1,
					totalQuantity: 1
				}
			},
			{
				$sort: { year: 1, month: 1, type: 1 }
			}
		]);

		// Get top causes receiving item donations
		const topCauses = await Donation.aggregate([
			{
				$match: matchCondition
			},
			{
				$lookup: {
					from: "causes",
					localField: "cause",
					foreignField: "_id",
					as: "causeInfo"
				}
			},
			{
				$unwind: "$causeInfo"
			},
			{
				$group: {
					_id: "$cause",
					causeName: { $first: "$causeInfo.title" },
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
					types: { $addToSet: "$type" }
				}
			},
			{
				$project: {
					_id: 0,
					causeId: "$_id",
					causeName: 1,
					count: 1,
					totalQuantity: 1,
					types: 1
				}
			},
			{
				$sort: { count: -1 }
			},
			{
				$limit: 5
			}
		]);

		// Combine the results
		const response = {
			donationsByType,
			monthlyTrend,
			topCauses
		};

		console.log("Item donation analytics calculated");

		res.status(200).json({
			success: true,
			data: response,
		});
	} catch (error) {
		console.error("Failed to fetch item donation analytics:", error);
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
			.populate("organization", "_id name");

		console.log("donnnnnnnnation", donation?.organization._id);
		if (!donation) {
			return res.status(404).json({
				success: false,
				message: "Donation not found",
			});
		}

		// Verify organization ownership
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

		console.log(
			"mail data---------",
			"jshailesh798@gmail.com",
			donation._id.toString(),
			status,
			donation.amount,
			donation.quantity,
			donation.unit
		);
		// Update donation status
		donation.status = status;

		// If donation is being confirmed or received and it's a monetary donation,
		// update the cause's raisedAmount
		if (
			(status === DonationStatus.CONFIRMED || status === DonationStatus.RECEIVED) &&
			donation.type === DonationType.MONEY &&
			donation.amount &&
			donation.cause
		) {
			// Find the cause and update its raisedAmount
			const causeId = donation.cause;
			const cause = await Cause.findById(causeId);
			if (cause) {
				cause.raisedAmount += donation.amount;
				await cause.save();
				console.log(`Updated cause ${cause._id} raisedAmount to ${cause.raisedAmount}`);
			}
		}

		// Save the updated donation
		await donation.save();

		// Send email notification to donor
		let emailStatus = "No email sent";
		if (donation.donor?.email) {
			try {
				await sendEmail(
					donation.donor.email,
					donation._id.toString(),
					status,
					donation.amount,
					donation.quantity,
					donation.unit
				);
				emailStatus = "Email sent successfully";
			} catch (emailError) {
				console.error(`Failed to send email for donation ${donationId}:`, emailError);
				emailStatus = "Failed to send email";
			}
		} else {
			console.warn(`No email provided for donor of donation ${donationId}`);
			emailStatus = "No donor email provided";
		}

		let notificationStatus = "No notification created";
		if (donation.donor?._id) {
			try {
				await Notification.create({
					recipient: donation.donor._id, // Changed from userId to recipient to match schema
					type: NotificationType.DONATION_STATUS_UPDATED, // Use the enum from NotificationType
					title: `Donation Status Update`, // Added required title field
					message: `Your donation (ID: ${donation._id}) has been updated to ${status}.`,
					isRead: false, // Changed from status: "UNREAD" to isRead: false to match schema
					data: { donationId: donation._id, status }, // Optional: include additional data
				});
				console.log(`Notification created for donor ${donation.donor._id}`);
				notificationStatus = "Notification created successfully";
			} catch (notificationError) {
				console.error(
					`Failed to create notification for donation ${donationId}:`,
					notificationError
				);
				notificationStatus = "Failed to create notification";
			}
		} else {
			console.warn(`No donor ID provided for donation ${donationId}`);
			notificationStatus = "No donor ID provided";
		}

		// Return the updated donation
		res.status(200).json({
			success: true,
			data: donation,
			message: `Donation status updated to ${status}`,
			emailStatus,
			notificationStatus, // Include notificationStatus in response for clarity
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