import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause from "../models/cause.model";
import Donation, {
	DonationStatus,
	DonationType,
} from "../models/donation.model";
import Organization from "../models/organization.model";
import { sendEmail } from "../utils/email";
import { generateDonationReceipt } from "../utils/pdfGenerator";
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
			isPickup: type === DonationType.MONEY ? false : Boolean(isPickup), // Always provide boolean
			contactPhone,
			contactEmail,
			notes,
		});

		await donation.save();

		// Populate the donation with organization and donor details for notification
		const populatedDonation = await Donation.findById(donation._id)
			.populate<{ donor: IUser }>("donor", "name email")
			.populate("organization", "_id name email")
			.populate("cause", "title");

		// Send real-time notification to organization about new donation
		let orgNotificationStatus = "No notification created";
		if (populatedDonation?.organization && (req as any).notificationService) {
			try {
				// Find the organization document to get the userId
				const orgDoc = await Organization.findById(
					populatedDonation.organization._id
				);

				if (orgDoc?.userId) {
					await (
						req as any
					).notificationService.createDonationReceivedNotification(
						orgDoc.userId.toString(),
						{
							donorName: populatedDonation.donor?.name || "Anonymous Donor",
							amount: type === DonationType.MONEY ? amount || 0 : 0,
							cause:
								(populatedDonation.cause as any)?.title || "your organization",
							donationId: donation._id.toString(),
						}
					);
					orgNotificationStatus = "Real-time notification created successfully";
				}
			} catch (notificationError) {
				orgNotificationStatus = "Failed to create real-time notification";
			}
		}

		// Send email notification to organization
		let orgEmailStatus = "No email sent";
		const organizationData = populatedDonation?.organization as any;
		if (organizationData?.email) {
			try {
				await sendEmail(
					organizationData.email,
					donation._id.toString(),
					DonationStatus.PENDING,
					amount,
					quantity,
					unit
				);
				orgEmailStatus = "Email sent successfully to organization";
			} catch (emailError) {
				orgEmailStatus = "Failed to send email to organization";
			}
		}

		res.status(201).json({
			success: true,
			data: donation,
			orgNotificationStatus,
			orgEmailStatus,
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
			.populate("cause", "title")
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

export const getDonorStats = async (req: Request, res: Response) => {
	try {
		// Get user ID if authenticated
		const userId = req.user?._id;

		// Create base match condition for confirmed/received donations
		const baseMatchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		};

		// If user is authenticated, filter by their donations
		if (userId) {
			baseMatchCondition.donor = userId;
		}

		// Match condition for monetary donations
		const moneyMatchCondition = {
			...baseMatchCondition,
			type: DonationType.MONEY,
		};

		// Get monetary donation statistics
		const moneyDonationStats = await Donation.aggregate([
			{
				$match: moneyMatchCondition,
			},
			{
				$group: {
					_id: null,
					totalDonated: { $sum: "$amount" },
					averageDonation: { $avg: "$amount" },
					donationCount: { $sum: 1 },
				},
			},
			{
				$project: {
					_id: 0,
					totalDonated: 1,
					averageDonation: { $round: ["$averageDonation", 2] },
					donationCount: 1,
				},
			},
		]);

		// Get count of unique causes supported (for all donation types)
		const causesSupported = await Donation.aggregate([
			{
				$match: baseMatchCondition,
			},
			{
				$group: {
					_id: "$cause",
				},
			},
			{
				$group: {
					_id: null,
					totalCauses: { $sum: 1 },
				},
			},
			{
				$project: {
					_id: 0,
					totalCauses: 1,
				},
			},
		]);

		// Get item donation statistics
		const itemMatchCondition = {
			...baseMatchCondition,
			type: { $ne: DonationType.MONEY },
		};

		const itemDonationStats = await Donation.aggregate([
			{
				$match: itemMatchCondition,
			},
			{
				$group: {
					_id: "$type",
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
				},
			},
			{
				$project: {
					_id: 0,
					type: "$_id",
					count: 1,
					totalQuantity: 1,
				},
			},
		]);

		// Get total item donations count
		const totalItemDonations =
			await Donation.countDocuments(itemMatchCondition);

		// Combine the results
		const response = {
			monetary: {
				totalDonated: moneyDonationStats[0]?.totalDonated || 0,
				averageDonation: moneyDonationStats[0]?.averageDonation || 0,
				donationCount: moneyDonationStats[0]?.donationCount || 0,
			},
			items: {
				totalDonations: totalItemDonations,
				byType: itemDonationStats,
			},
			totalCauses: causesSupported[0]?.totalCauses || 0,
		};

		res.status(200).json({
			success: true,
			data: response,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Something went wrong",
		});
	}
};

export const getItemDonationTypeAnalytics = async (
	req: Request,
	res: Response
) => {
	try {
		const { type } = req.params;

		// Validate donation type
		if (!type || !Object.values(DonationType).includes(type as DonationType)) {
			return res.status(400).json({
				success: false,
				message: "Valid donation type is required",
			});
		}

		// Get user ID and role if authenticated
		const userId = req.user?._id;
		const userRole = req.user?.role;

		// Create match condition for confirmed/received donations of the specified type
		const matchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			type: type,
		};

		// Filter based on user role
		if (userId) {
			if (userRole === "donor") {
				// For donors, show only their donations
				matchCondition.donor = userId;
			} else if (userRole === "organization") {
				// For organizations, show donations received by their organization
				matchCondition.organization = userId;
			}
			// For admin or other roles, show all donations (no additional filter)
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
				$match: matchCondition,
			},
			{
				$group: {
					_id: null,
					totalDonations: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
					avgQuantity: { $avg: "$quantity" },
				},
			},
			{
				$project: {
					_id: 0,
					totalDonations: 1,
					totalQuantity: 1,
					avgQuantity: { $round: ["$avgQuantity", 2] },
				},
			},
		]);

		// Get monthly trend
		const today = new Date();
		const sixMonthsAgo = new Date(today);
		sixMonthsAgo.setMonth(today.getMonth() - 5);

		const monthlyTrend = await Donation.aggregate([
			{
				$match: {
					...matchCondition,
					createdAt: { $gte: sixMonthsAgo },
				},
			},
			{
				$group: {
					_id: {
						year: { $year: "$createdAt" },
						month: { $month: "$createdAt" },
					},
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
				},
			},
			{
				$project: {
					_id: 0,
					year: "$_id.year",
					month: "$_id.month",
					count: 1,
					totalQuantity: 1,
				},
			},
			{
				$sort: { year: 1, month: 1 },
			},
		]);

		// Get top causes for this donation type
		const topCauses = await Donation.aggregate([
			{
				$match: matchCondition,
			},
			{
				$lookup: {
					from: "causes",
					localField: "cause",
					foreignField: "_id",
					as: "causeInfo",
				},
			},
			{
				$unwind: "$causeInfo",
			},
			{
				$group: {
					_id: "$cause",
					causeName: { $first: "$causeInfo.title" },
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
				},
			},
			{
				$project: {
					_id: 0,
					causeId: "$_id",
					causeName: 1,
					count: 1,
					totalQuantity: 1,
				},
			},
			{
				$sort: { count: -1 },
			},
			{
				$limit: 5,
			},
		]);

		// Combine the results
		const response = {
			type,
			stats: stats[0] || {
				totalDonations: 0,
				totalQuantity: 0,
				avgQuantity: 0,
			},
			recentDonations: donations.map((d) => ({
				id: d._id,
				description: d.description,
				quantity: d.quantity,
				unit: d.unit,
				cause: d.cause
					? {
							id: (d.cause as any)._id,
							title: (d.cause as any).title,
						}
					: null,
				organization: d.organization
					? {
							id: (d.organization as any)._id,
							name: (d.organization as any).name,
						}
					: null,
				createdAt: d.createdAt,
			})),
			monthlyTrend,
			topCauses,
		};

		res.status(200).json({
			success: true,
			data: response,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Something went wrong",
		});
	}
};

export const getItemDonationAnalytics = async (req: Request, res: Response) => {
	try {
		// Get user ID and role if authenticated
		const userId = req.user?._id;
		const userRole = req.user?.role;

		// Create base match condition for confirmed/received item donations
		const matchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			type: { $ne: DonationType.MONEY },
		};

		// Filter based on user role
		if (userId) {
			if (userRole === "donor") {
				// For donors, show only their donations
				matchCondition.donor = userId;
			} else if (userRole === "organization") {
				// For organizations, show donations received by their organization
				matchCondition.organization = userId;
			}
			// For admin or other roles, show all donations (no additional filter)
		}

		// Get item donation statistics by type
		const donationsByType = await Donation.aggregate([
			{
				$match: matchCondition,
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
							createdAt: "$createdAt",
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					type: "$_id",
					count: 1,
					totalQuantity: 1,
					items: { $slice: ["$items", 5] }, // Limit to 5 most recent items per type
				},
			},
			{
				$sort: { count: -1 },
			},
		]);

		// Get monthly trend of item donations
		const today = new Date();
		const sixMonthsAgo = new Date(today);
		sixMonthsAgo.setMonth(today.getMonth() - 5);

		const monthlyTrend = await Donation.aggregate([
			{
				$match: {
					...matchCondition,
					createdAt: { $gte: sixMonthsAgo },
				},
			},
			{
				$group: {
					_id: {
						year: { $year: "$createdAt" },
						month: { $month: "$createdAt" },
						type: "$type",
					},
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
				},
			},
			{
				$project: {
					_id: 0,
					year: "$_id.year",
					month: "$_id.month",
					type: "$_id.type",
					count: 1,
					totalQuantity: 1,
				},
			},
			{
				$sort: { year: 1, month: 1, type: 1 },
			},
		]);

		// Get top causes receiving item donations
		const topCauses = await Donation.aggregate([
			{
				$match: matchCondition,
			},
			{
				$lookup: {
					from: "causes",
					localField: "cause",
					foreignField: "_id",
					as: "causeInfo",
				},
			},
			{
				$unwind: "$causeInfo",
			},
			{
				$group: {
					_id: "$cause",
					causeName: { $first: "$causeInfo.title" },
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" },
					types: { $addToSet: "$type" },
				},
			},
			{
				$project: {
					_id: 0,
					causeId: "$_id",
					causeName: 1,
					count: 1,
					totalQuantity: 1,
					types: 1,
				},
			},
			{
				$sort: { count: -1 },
			},
			{
				$limit: 5,
			},
		]);

		// Combine the results
		const response = {
			donationsByType,
			monthlyTrend,
			topCauses,
		};

		res.status(200).json({
			success: true,
			data: response,
		});
	} catch (error) {
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

		// Use aggregation pipeline to properly join donor information
		const donationsAggregation = await Donation.aggregate([
			{
				$match: {
					organization: new mongoose.Types.ObjectId(organizationId),
					status: status,
				},
			},
			{
				$lookup: {
					from: "users",
					localField: "donor",
					foreignField: "_id",
					as: "donorUser",
				},
			},
			{
				$lookup: {
					from: "donorprofiles",
					localField: "donor",
					foreignField: "userId",
					as: "donorProfile",
				},
			},
			{
				$lookup: {
					from: "causes",
					localField: "cause",
					foreignField: "_id",
					as: "causeInfo",
				},
			},
			{
				$unwind: {
					path: "$donorUser",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$unwind: {
					path: "$donorProfile",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$unwind: {
					path: "$causeInfo",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$addFields: {
					"donor.name": {
						$cond: {
							if: {
								$and: ["$donorProfile.firstName", "$donorProfile.lastName"],
							},
							then: {
								$concat: [
									"$donorProfile.firstName",
									" ",
									"$donorProfile.lastName",
								],
							},
							else: "$donorUser.email",
						},
					},
					"donor.email": "$donorUser.email",
					"donor.phone": "$donorProfile.phoneNumber",
					"donor._id": "$donorUser._id",
					"cause.title": "$causeInfo.title",
					"cause._id": "$causeInfo._id",
				},
			},
			{
				$sort: { createdAt: -1 },
			},
			{
				$skip: (page - 1) * limit,
			},
			{
				$limit: limit,
			},
		]);

		// Get total count for pagination
		const total = await Donation.countDocuments({
			organization: organizationId,
			status: status,
		});

		// Return the results
		res.status(200).json({
			success: true,
			data: donationsAggregation,
			pagination: {
				total,
				page,
				pages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
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

		if (!donation) {
			return res.status(404).json({
				success: false,
				message: "Donation not found",
			});
		}

		// Verify organization ownership
		const organization = await Organization.findOne({
			_id: donation?.organization._id,
			userId: req.user._id, // Check if the current user owns this organization
		});

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

		// If donation is being confirmed or received and it's a monetary donation,
		// update the cause's raisedAmount
		if (
			(status === DonationStatus.CONFIRMED ||
				status === DonationStatus.RECEIVED) &&
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
				emailStatus = "Failed to send email";
			}
		} else {
			emailStatus = "No donor email provided";
		}

		let notificationStatus = "No notification created";
		if (donation.donor?._id && (req as any).notificationService) {
			try {
				await (req as any).notificationService.createDonationStatusNotification(
					donation.donor._id.toString(),
					{
						donationId: donation._id.toString(),
						status: status,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				);

				notificationStatus = "Real-time notification created successfully";
			} catch (notificationError) {
				notificationStatus = "Failed to create real-time notification";
			}
		} else {
			notificationStatus = "No donor ID provided";
		}

		// Return the updated donation
		res.status(200).json({
			success: true,
			data: donation,
			message: `Donation status updated to ${status}`,
			emailStatus,
			notificationStatus,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error updating donation status",
			error: error?.message || "Unknown error occurred",
		});
	}
};

// Mark donation as received with photo upload
export const markDonationAsReceived = async (req: Request, res: Response) => {
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

		// Validate input
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res.status(400).json({
				success: false,
				message: "Valid donation ID is required",
			});
		}

		// Check if a photo was uploaded
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Photo is required to mark donation as received",
			});
		}

		// Find the donation
		const donation = await Donation.findById(donationId)
			.populate<{ donor: IUser }>("donor", "name email")
			.populate("cause", "title")
			.populate("organization", "_id name");

		if (!donation) {
			return res.status(404).json({
				success: false,
				message: "Donation not found",
			});
		}

		// Verify organization ownership
		const organization = await Organization.findOne({
			_id: donation?.organization._id,
			userId: req.user._id, // Check if the current user owns this organization
		});

		if (!organization) {
			return res.status(403).json({
				success: false,
				message: "You do not have permission to update this donation",
			});
		}

		// Check if the current status is APPROVED or PENDING
		if (donation.status !== DonationStatus.APPROVED) {
			return res.status(400).json({
				success: false,
				message: "Only approved can be marked as received",
			});
		}

		// Get the photo file path
		const photoUrl = `/uploads/donation-photos/${req.file.filename}`;

		// Update donation status and receipt image
		donation.status = DonationStatus.RECEIVED;
		donation.receiptImage = photoUrl;

		// Store photo metadata for better tracking
		donation.receiptImageMetadata = {
			originalName: req.file.originalname,
			mimeType: req.file.mimetype,
			fileSize: req.file.size,
			uploadedAt: new Date(),
			uploadedBy: new mongoose.Types.ObjectId(req.user._id),
		};

		// If it's a monetary donation, update the cause's raisedAmount
		if (
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
					DonationStatus.RECEIVED,
					donation.amount,
					donation.quantity,
					donation.unit,
					photoUrl // Pass the photo URL to the email function
				);
				emailStatus = "Email sent successfully";
			} catch (emailError) {
				emailStatus = "Failed to send email";
			}
		} else {
			emailStatus = "No donor email provided";
		}

		// Create real-time notification for donor
		let notificationStatus = "No notification created";
		if (donation.donor?._id && (req as any).notificationService) {
			try {
				await (req as any).notificationService.createDonationStatusNotification(
					donation.donor._id.toString(),
					{
						donationId: donation._id.toString(),
						status: DonationStatus.RECEIVED,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				);

				notificationStatus = "Real-time notification created successfully";
			} catch (notificationError) {
				notificationStatus = "Failed to create real-time notification";
			}
		} else {
			notificationStatus = "No donor ID provided";
		}

		// Return the updated donation
		res.status(200).json({
			success: true,
			data: donation,
			message: "Donation marked as received with photo",
			emailStatus,
			notificationStatus,
			photoUrl,
		});
	} catch (error: any) {
		console.error("Error marking donation as received:", error);

		// Determine the appropriate status code
		const statusCode = error?.status || error?.statusCode || 500;

		// Create a detailed error response
		res.status(statusCode).json({
			success: false,
			message: "Error marking donation as received",
			error: error?.message || "Unknown error occurred",
			details: {
				name: error?.name,
				code: error?.code,
				path: error?.path,
				type: typeof error,
			},
		});
	}
};

// Confirm donation receipt by donor
export const confirmDonationReceipt = async (req: Request, res: Response) => {
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

		// Validate input
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res.status(400).json({
				success: false,
				message: "Valid donation ID is required",
			});
		}

		// Find the donation
		const donation = await Donation.findById(donationId).populate(
			"organization",
			"name email"
		);

		if (!donation) {
			return res.status(404).json({
				success: false,
				message: "Donation not found",
			});
		}

		// Verify donor ownership
		if (donation.donor.toString() !== req.user._id.toString()) {
			return res.status(403).json({
				success: false,
				message: "You do not have permission to confirm this donation",
			});
		}

		// Check if the current status is RECEIVED
		if (donation.status !== DonationStatus.RECEIVED) {
			return res.status(400).json({
				success: false,
				message: "Only received donations can be confirmed",
			});
		}

		// Generate PDF receipt for the donor
		let pdfReceiptUrl = "";
		try {
			const donationData = {
				donationId: donation._id.toString(),
				donorName: (req.user as any)?.name || "Anonymous Donor",
				donorEmail: (req.user as any)?.email || "No email provided",
				organizationName:
					(donation.organization as any)?.name || "Organization",
				organizationEmail:
					(donation.organization as any)?.email || "No email provided",
				amount: donation.amount,
				quantity: donation.quantity,
				unit: donation.unit,
				type: donation.type,
				description: donation.description || "No description provided",
				receivedDate: new Date(),
				cause: (donation.cause as any)?.title || undefined,
			};

			pdfReceiptUrl = await generateDonationReceipt(donationData);
		} catch (pdfError) {
			console.error("Failed to generate PDF receipt:", pdfError);
			// Continue with the process even if PDF generation fails
		}

		// Update donation status and confirmation date
		donation.status = DonationStatus.CONFIRMED;
		donation.confirmationDate = new Date();

		// Store the PDF receipt URL if generated successfully
		if (pdfReceiptUrl) {
			donation.pdfReceiptUrl = pdfReceiptUrl;
		}

		// Save the updated donation
		await donation.save();

		// Send email notification to donor with receipt
		let donorEmailStatus = "No email sent to donor";
		if ((req.user as any)?.email) {
			try {
				await sendEmail(
					(req.user as any).email,
					donation._id.toString(),
					DonationStatus.CONFIRMED,
					donation.amount,
					donation.quantity,
					donation.unit,
					undefined, // no photo URL needed for confirmed status
					pdfReceiptUrl // pass the PDF receipt URL
				);
				donorEmailStatus = "Email sent successfully to donor with receipt";
			} catch (emailError) {
				console.error(
					`Failed to send email to donor for donation ${donationId}:`,
					emailError
				);
				donorEmailStatus = "Failed to send email to donor";
			}
		} else {
			console.warn(`No email provided for donor of donation ${donationId}`);
			donorEmailStatus = "No donor email provided";
		}

		// Send email notification to organization
		let orgEmailStatus = "No email sent to organization";
		const organizationData = donation.organization as any;
		if (organizationData?.email) {
			try {
				await sendEmail(
					organizationData.email,
					donation._id.toString(),
					DonationStatus.CONFIRMED,
					donation.amount,
					donation.quantity,
					donation.unit
				);
				orgEmailStatus = "Email sent successfully to organization";
			} catch (emailError) {
				console.error(
					`Failed to send email to organization for donation ${donationId}:`,
					emailError
				);
				orgEmailStatus = "Failed to send email to organization";
			}
		} else {
			console.warn(
				`No email provided for organization of donation ${donationId}`
			);
			orgEmailStatus = "No organization email provided";
		}

		// Create real-time notification for organization
		let notificationStatus = "No notification created";
		if (donation.organization && (req as any).notificationService) {
			try {
				// Find the organization document to get the userId
				const orgDoc = await Organization.findById(donation.organization._id);
				if (orgDoc?.userId) {
					await (
						req as any
					).notificationService.createDonationStatusNotification(
						orgDoc.userId.toString(),
						{
							donationId: donation._id.toString(),
							status: DonationStatus.CONFIRMED,
							organizationName:
								(donation.organization as any)?.name || "Organization",
							cause: (donation.cause as any)?.title || "Unknown cause",
						}
					);
					notificationStatus = "Real-time notification created successfully";
				} else {
					notificationStatus = "No organization userId found";
				}
			} catch (notificationError) {
				console.error(
					`Failed to create real-time notification for donation ${donationId}:`,
					notificationError
				);
				notificationStatus = "Failed to create real-time notification";
			}
		}

		// Return the updated donation
		res.status(200).json({
			success: true,
			data: donation,
			message: "Donation confirmed successfully with receipt generated",
			donorEmailStatus,
			orgEmailStatus,
			notificationStatus,
			pdfReceiptUrl: pdfReceiptUrl || null,
		});
	} catch (error: any) {
		console.error("Error confirming donation:", error);
		res.status(500).json({
			success: false,
			message: "Error confirming donation",
			error: error?.message || "Unknown error occurred",
		});
	}
};

// Mark donation as confirmed with receipt upload (for organizations)
export const markDonationAsConfirmed = async (req: Request, res: Response) => {
	try {
		// Check if user is authenticated
		if (!req.user?._id) {
			console.error("User not authenticated");
			return res.status(401).json({
				success: false,
				message: "User not authenticated",
			});
		}

		// Get donation ID from request params
		const { donationId } = req.params;

		// Validate input
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res.status(400).json({
				success: false,
				message: "Valid donation ID is required",
			});
		}

		// Check if file was uploaded
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Receipt file is required",
			});
		}

		// Find the donation and populate necessary fields
		const donation = await Donation.findById(donationId)
			.populate("donor", "email")
			.populate("organization", "name email");

		if (!donation) {
			return res.status(404).json({
				success: false,
				message: "Donation not found",
			});
		}

		// Verify organization ownership
		const organization = await Organization.findOne({
			_id: donation?.organization._id,
			userId: req.user._id, // Check if the current user owns this organization
		});

		if (!organization) {
			return res.status(403).json({
				success: false,
				message: "You do not have permission to update this donation",
			});
		}

		// Check if the current status is RECEIVED
		if (donation.status !== DonationStatus.RECEIVED) {
			return res.status(400).json({
				success: false,
				message: "Only received donations can be marked as confirmed",
			});
		}

		// Get the receipt file path
		const receiptUrl = `/uploads/receipts/${req.file.filename}`;

		// Generate PDF receipt for the donor
		let pdfReceiptUrl = "";
		try {
			const donationData = {
				donationId: donation._id.toString(),
				donorName: (donation.donor as any)?.name || "Anonymous Donor",
				donorEmail: (donation.donor as any)?.email || "No email provided",
				organizationName:
					(donation.organization as any)?.name || "Organization",
				organizationEmail:
					(donation.organization as any)?.email || "No email provided",
				amount: donation.amount,
				quantity: donation.quantity,
				unit: donation.unit,
				type: donation.type,
				description: donation.description || "No description provided",
				receivedDate: new Date(),
				cause: (donation.cause as any)?.title || undefined,
			};

			pdfReceiptUrl = await generateDonationReceipt(donationData);
		} catch (pdfError) {
			console.error("Failed to generate PDF receipt:", pdfError);
			// Continue with the process even if PDF generation fails
		}

		// Update donation status and receipt
		donation.status = DonationStatus.CONFIRMED;
		donation.receiptImage = receiptUrl;
		donation.confirmationDate = new Date();

		// Store the PDF receipt URL if generated successfully
		if (pdfReceiptUrl) {
			donation.pdfReceiptUrl = pdfReceiptUrl;
		}

		// Store receipt metadata for better tracking
		donation.receiptImageMetadata = {
			originalName: req.file.originalname,
			mimeType: req.file.mimetype,
			fileSize: req.file.size,
			uploadedAt: new Date(),
			uploadedBy: new mongoose.Types.ObjectId(req.user._id),
		};

		// Save the updated donation
		await donation.save();

		// Send email notification to donor with PDF receipt
		let emailStatus = "No email sent";
		const donorData = donation.donor as any;
		if (donorData?.email) {
			try {
				await sendEmail(
					donorData.email,
					donation._id.toString(),
					DonationStatus.CONFIRMED,
					donation.amount,
					donation.quantity,
					donation.unit,
					undefined, // no photo URL needed for confirmed status
					pdfReceiptUrl // pass the PDF receipt URL
				);
				emailStatus = "Email sent successfully to donor with receipt";
			} catch (emailError) {
				console.error(
					`Failed to send email to donor for donation ${donationId}:`,
					emailError
				);
				emailStatus = "Failed to send email to donor";
			}
		} else {
			console.warn(`No email provided for donor of donation ${donationId}`);
			emailStatus = "No donor email provided";
		}

		// Create real-time notification for donor
		let notificationStatus = "No notification created";
		if (donation.donor?._id && (req as any).notificationService) {
			try {
				await (req as any).notificationService.createDonationStatusNotification(
					donation.donor._id.toString(),
					{
						donationId: donation._id.toString(),
						status: DonationStatus.CONFIRMED,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				);

				notificationStatus = "Real-time notification created successfully";
			} catch (notificationError) {
				console.error(
					`Failed to create real-time notification for donation ${donationId}:`,
					notificationError
				);
				notificationStatus = "Failed to create real-time notification";
			}
		} else {
			console.warn(`No donor ID provided for donation ${donationId}`);
			notificationStatus = "No donor ID provided";
		}

		// Return the updated donation
		res.status(200).json({
			success: true,
			data: donation,
			message: "Donation marked as confirmed with receipt generated",
			emailStatus,
			notificationStatus,
			receiptUrl,
			pdfReceiptUrl: pdfReceiptUrl || null,
		});
	} catch (error: any) {
		console.error("Error marking donation as confirmed:", error);
		res.status(500).json({
			success: false,
			message: "Error marking donation as confirmed",
			error: error?.message || "Unknown error occurred",
		});
	}
};
