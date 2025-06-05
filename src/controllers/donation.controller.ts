import { Request, Response } from "express";
import mongoose from "mongoose";
import Donation, {
	DonationStatus,
	DonationType,
} from "../models/donation.model";
import Organization from "../models/organization.model";
import { sendEmail } from "../utils/email";
import { generateDonationReceipt } from "../utils/pdfGenerator";
import { IUser } from "../types";

// Helper to send notifications
const sendNotification = async (
	req: any,
	userId: string,
	type: string,
	data: any
) => {
	try {
		if (req.notificationService) {
			if (type === "received") {
				await req.notificationService.createDonationReceivedNotification(
					userId,
					data
				);
			} else {
				await req.notificationService.createDonationStatusNotification(
					userId,
					data
				);
			}
			return "Real-time notification created successfully";
		}
	} catch {
		return "Failed to create real-time notification";
	}
	return "No notification created";
};

export const createDonation = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id)
			return res.status(401).json({ message: "User not authenticated" });

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

		const organizationDoc = await Organization.findById(organization);
		if (!organizationDoc)
			return res
				.status(400)
				.json({ success: false, message: "Organization not found" });

		const donation = await new Donation({
			donor: req.user._id,
			organization: organizationDoc._id,
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
			isPickup: type === DonationType.MONEY ? false : Boolean(isPickup),
			contactPhone,
			contactEmail,
			notes,
		}).save();

		const populatedDonation = await Donation.findById(donation._id)
			.populate<{ donor: IUser }>("donor", "name email")
			.populate("organization", "_id name email")
			.populate("cause", "title");

		// Send notifications
		let orgNotificationStatus = "No notification created";
		if (populatedDonation?.organization) {
			const orgDoc = await Organization.findById(
				populatedDonation.organization._id
			);
			if (orgDoc?.userId) {
				orgNotificationStatus = await sendNotification(
					req as any,
					orgDoc.userId.toString(),
					"received",
					{
						donorName: populatedDonation.donor?.name || "Anonymous Donor",
						amount: type === DonationType.MONEY ? amount || 0 : 0,
						cause:
							(populatedDonation.cause as any)?.title || "your organization",
						donationId: donation._id.toString(),
					}
				);
			}
		}

		// Send email
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
			} catch {
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
		if (!req.user?._id)
			return res.status(401).json({ message: "User not authenticated" });

		const { status, type, page = 1, limit = 10 } = req.query;
		const query: any = { donor: req.user._id };

		if (status) query.status = status;
		if (type) query.type = type;

		const [donations, total] = await Promise.all([
			Donation.find(query)
				.populate("organization", "name email phone")
				.populate("cause", "title")
				.select("+receiptImage +pdfReceiptUrl +receiptImageMetadata")
				.sort({ createdAt: -1 })
				.skip((Number(page) - 1) * Number(limit))
				.limit(Number(limit)),
			Donation.countDocuments(query),
		]);

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

export const getDonationById = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid donation ID" });
		}

		const donation = await Donation.findById(id)
			.populate("donor", "firstName lastName email")
			.populate("organization", "name email phone")
			.populate("cause", "title")
			.populate("campaign", "title")
			.select("+receiptImage +pdfReceiptUrl +receiptImageMetadata");

		if (!donation)
			return res
				.status(404)
				.json({ success: false, message: "Donation not found" });

		// Check permissions
		if (req.user?._id) {
			const userId = req.user._id.toString();
			const isDonor = userId === donation.donor._id.toString();

			let isOrganization = false;
			if (req.user.role === "organization") {
				const organization = await Organization.findOne({
					userId: req.user._id,
				});
				if (organization) {
					isOrganization =
						organization._id.toString() ===
						donation.organization._id.toString();
				}
			}

			if (!isDonor && !isOrganization && req.user.role !== "admin") {
				return res.status(403).json({
					success: false,
					message: "You don't have permission to view this donation",
				});
			}
		}

		res.status(200).json({ success: true, data: donation });
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching donation",
			error: error?.message || "Unknown error occurred",
		});
	}
};

export const getDonorStats = async (req: Request, res: Response) => {
	try {
		const userId = req.user?._id;
		const baseMatchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		};
		if (userId) baseMatchCondition.donor = userId;

		const moneyMatchCondition = {
			...baseMatchCondition,
			type: DonationType.MONEY,
		};
		const itemMatchCondition = {
			...baseMatchCondition,
			type: { $ne: DonationType.MONEY },
		};

		const [
			moneyDonationStats,
			causesSupported,
			itemDonationStats,
			totalItemDonations,
		] = await Promise.all([
			Donation.aggregate([
				{ $match: moneyMatchCondition },
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
			]),
			Donation.aggregate([
				{ $match: baseMatchCondition },
				{ $group: { _id: "$cause" } },
				{ $group: { _id: null, totalCauses: { $sum: 1 } } },
				{ $project: { _id: 0, totalCauses: 1 } },
			]),
			Donation.aggregate([
				{ $match: itemMatchCondition },
				{
					$group: {
						_id: "$type",
						count: { $sum: 1 },
						totalQuantity: { $sum: "$quantity" },
					},
				},
				{ $project: { _id: 0, type: "$_id", count: 1, totalQuantity: 1 } },
			]),
			Donation.countDocuments(itemMatchCondition),
		]);

		res.status(200).json({
			success: true,
			data: {
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
			},
		});
	} catch (error) {
		res.status(500).json({ success: false, message: "Something went wrong" });
	}
};

export const getItemDonationTypeAnalytics = async (
	req: Request,
	res: Response
) => {
	try {
		const { type } = req.params;
		if (!type || !Object.values(DonationType).includes(type as DonationType)) {
			return res
				.status(400)
				.json({ success: false, message: "Valid donation type is required" });
		}

		const userId = req.user?._id;
		const userRole = req.user?.role;
		const matchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			type: type,
		};

		if (userId) {
			if (userRole === "donor") {
				matchCondition.donor = userId;
			} else if (userRole === "organization") {
				const organizationDoc = await Organization.findOne({ userId: userId });
				matchCondition.organization =
					organizationDoc?._id || new mongoose.Types.ObjectId();
			}
		}

		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

		const [donations, stats, monthlyTrend, topCauses] = await Promise.all([
			Donation.find(matchCondition)
				.populate("cause", "title")
				.populate("organization", "name")
				.sort({ createdAt: -1 })
				.limit(20)
				.lean(),
			Donation.aggregate([
				{ $match: matchCondition },
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
			]),
			Donation.aggregate([
				{ $match: { ...matchCondition, createdAt: { $gte: sixMonthsAgo } } },
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
				{ $sort: { year: 1, month: 1 } },
			]),
			Donation.aggregate([
				{ $match: matchCondition },
				{
					$lookup: {
						from: "causes",
						localField: "cause",
						foreignField: "_id",
						as: "causeInfo",
					},
				},
				{ $unwind: "$causeInfo" },
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
				{ $sort: { count: -1 } },
				{ $limit: 5 },
			]),
		]);

		res.status(200).json({
			success: true,
			data: {
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
						? { id: (d.cause as any)._id, title: (d.cause as any).title }
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
			},
		});
	} catch (error) {
		res.status(500).json({ success: false, message: "Something went wrong" });
	}
};

export const getItemDonationAnalytics = async (req: Request, res: Response) => {
	try {
		const userId = req.user?._id;
		const userRole = req.user?.role;
		const matchCondition: any = {
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			type: { $ne: DonationType.MONEY },
		};

		if (userId) {
			if (userRole === "donor") {
				matchCondition.donor = userId;
			} else if (userRole === "organization") {
				const organizationDoc = await Organization.findOne({ userId: userId });
				matchCondition.organization =
					organizationDoc?._id || new mongoose.Types.ObjectId();
			}
		}

		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

		const [donationsByType, monthlyTrend, topCauses] = await Promise.all([
			Donation.aggregate([
				{ $match: matchCondition },
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
						items: { $slice: ["$items", 5] },
					},
				},
				{ $sort: { count: -1 } },
			]),
			Donation.aggregate([
				{ $match: { ...matchCondition, createdAt: { $gte: sixMonthsAgo } } },
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
				{ $sort: { year: 1, month: 1, type: 1 } },
			]),
			Donation.aggregate([
				{ $match: matchCondition },
				{
					$lookup: {
						from: "causes",
						localField: "cause",
						foreignField: "_id",
						as: "causeInfo",
					},
				},
				{ $unwind: "$causeInfo" },
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
				{ $sort: { count: -1 } },
				{ $limit: 5 },
			]),
		]);

		res.status(200).json({
			success: true,
			data: { donationsByType, monthlyTrend, topCauses },
		});
	} catch (error) {
		res.status(500).json({ success: false, message: "Something went wrong" });
	}
};

export const findOrganizationPendingDonations = async (
	req: Request,
	res: Response
) => {
	try {
		const { organizationId } = req.params;
		if (!organizationId)
			return res
				.status(400)
				.json({ success: false, message: "Organization ID is required" });

		const status = (req.query.status as string)?.toUpperCase() || "PENDING";
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;

		const [donationsAggregation, total] = await Promise.all([
			Donation.aggregate([
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
				{ $unwind: { path: "$donorUser", preserveNullAndEmptyArrays: true } },
				{
					$unwind: { path: "$donorProfile", preserveNullAndEmptyArrays: true },
				},
				{ $unwind: { path: "$causeInfo", preserveNullAndEmptyArrays: true } },
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
				{ $sort: { createdAt: -1 } },
				{ $skip: (page - 1) * limit },
				{ $limit: limit },
			]),
			Donation.countDocuments({ organization: organizationId, status: status }),
		]);

		res.status(200).json({
			success: true,
			data: donationsAggregation,
			pagination: { total, page, pages: Math.ceil(total / limit) },
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
		if (!req.user?._id)
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });

		const { donationId } = req.params;
		const { status } = req.body;

		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res
				.status(400)
				.json({ success: false, message: "Valid donation ID is required" });
		}

		if (!status || !Object.values(DonationStatus).includes(status)) {
			return res
				.status(400)
				.json({ success: false, message: "Valid status is required" });
		}

		if (status === DonationStatus.CANCELLED) {
			return res.status(403).json({
				success: false,
				message: "Organizations cannot cancel donations",
			});
		}

		const donation = await Donation.findById(donationId)
			.populate<{ donor: IUser }>("donor", "name email")
			.populate("cause", "title")
			.populate("organization", "_id name");

		if (!donation)
			return res
				.status(404)
				.json({ success: false, message: "Donation not found" });

		const organization = await Organization.findOne({
			_id: donation?.organization._id,
			userId: req.user._id,
		});
		if (!organization)
			return res.status(403).json({
				success: false,
				message: "You do not have permission to update this donation",
			});

		if (donation.status !== DonationStatus.PENDING) {
			return res.status(400).json({
				success: false,
				message: "Only pending donations can be updated",
			});
		}

		donation.status = status;
		await donation.save();

		// Send email
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
			} catch {
				emailStatus = "Failed to send email";
			}
		} else {
			emailStatus = "No donor email provided";
		}

		// Send notification
		const notificationStatus = donation.donor?._id
			? await sendNotification(
					req as any,
					donation.donor._id.toString(),
					"status",
					{
						donationId: donation._id.toString(),
						status: status,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				)
			: "No donor ID provided";

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

export const markDonationAsReceived = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id)
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });

		const { donationId } = req.params;
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res
				.status(400)
				.json({ success: false, message: "Valid donation ID is required" });
		}

		const cloudinaryResult = (req as any).cloudinaryResult;
		if (!cloudinaryResult)
			return res.status(400).json({
				success: false,
				message: "Photo upload to cloud storage failed",
			});

		const donation = await Donation.findById(donationId)
			.populate<{ donor: IUser }>("donor", "name email")
			.populate("cause", "title")
			.populate("organization", "_id name");

		if (!donation)
			return res
				.status(404)
				.json({ success: false, message: "Donation not found" });

		const organization = await Organization.findOne({
			_id: donation?.organization._id,
			userId: req.user._id,
		});
		if (!organization)
			return res.status(403).json({
				success: false,
				message: "You do not have permission to update this donation",
			});

		if (donation.status !== DonationStatus.APPROVED) {
			return res.status(400).json({
				success: false,
				message: "Only approved can be marked as received",
			});
		}

		const photoUrl = cloudinaryResult.url;
		donation.status = DonationStatus.RECEIVED;
		donation.receiptImage = photoUrl;
		donation.receiptImageMetadata = {
			originalName: cloudinaryResult.public_id.split("/").pop() || "unknown",
			mimeType: "image/jpeg",
			fileSize: 0,
			uploadedAt: new Date(),
			uploadedBy: new mongoose.Types.ObjectId(req.user._id),
			cloudinaryPublicId: cloudinaryResult.public_id,
			cloudinaryUrl: cloudinaryResult.url,
		};

		await donation.save();

		// Send email
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
					photoUrl
				);
				emailStatus = "Email sent successfully";
			} catch {
				emailStatus = "Failed to send email";
			}
		} else {
			emailStatus = "No donor email provided";
		}

		// Send notification
		const notificationStatus = donation.donor?._id
			? await sendNotification(
					req as any,
					donation.donor._id.toString(),
					"status",
					{
						donationId: donation._id.toString(),
						status: DonationStatus.RECEIVED,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				)
			: "No donor ID provided";

		res.status(200).json({
			success: true,
			data: donation,
			message: "Donation marked as received with photo",
			emailStatus,
			notificationStatus,
			photoUrl,
		});
	} catch (error: any) {
		const statusCode = error?.status || error?.statusCode || 500;
		res.status(statusCode).json({
			success: false,
			message: "Error marking donation as received",
			error: error?.message || "Unknown error occurred",
		});
	}
};

export const confirmDonationReceipt = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id)
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });

		const { donationId } = req.params;
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res
				.status(400)
				.json({ success: false, message: "Valid donation ID is required" });
		}

		const donation = await Donation.findById(donationId).populate(
			"organization",
			"name email"
		);
		if (!donation)
			return res
				.status(404)
				.json({ success: false, message: "Donation not found" });

		if (donation.donor.toString() !== req.user._id.toString()) {
			return res
				.status(403)
				.json({
					success: false,
					message: "You do not have permission to confirm this donation",
				});
		}

		if (donation.status !== DonationStatus.RECEIVED) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Only received donations can be confirmed",
				});
		}

		// Generate PDF receipt
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
			// Continue with the process even if PDF generation fails
		}

		donation.status = DonationStatus.CONFIRMED;
		donation.confirmationDate = new Date();
		if (pdfReceiptUrl) donation.pdfReceiptUrl = pdfReceiptUrl;
		await donation.save();

		// Send emails
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
					undefined,
					pdfReceiptUrl
				);
				donorEmailStatus = "Email sent successfully to donor with receipt";
			} catch {
				donorEmailStatus = "Failed to send email to donor";
			}
		} else {
			donorEmailStatus = "No donor email provided";
		}

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
			} catch {
				orgEmailStatus = "Failed to send email to organization";
			}
		} else {
			orgEmailStatus = "No organization email provided";
		}

		// Send notification
		let notificationStatus = "No notification created";
		if (donation.organization && (req as any).notificationService) {
			const orgDoc = await Organization.findById(donation.organization._id);
			if (orgDoc?.userId) {
				notificationStatus = await sendNotification(
					req as any,
					orgDoc.userId.toString(),
					"status",
					{
						donationId: donation._id.toString(),
						status: DonationStatus.CONFIRMED,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				);
			} else {
				notificationStatus = "No organization userId found";
			}
		}

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
		res
			.status(500)
			.json({
				success: false,
				message: "Error confirming donation",
				error: error?.message || "Unknown error occurred",
			});
	}
};

export const markDonationAsConfirmed = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id)
			return res
				.status(401)
				.json({ success: false, message: "User not authenticated" });

		const { donationId } = req.params;
		if (!donationId || !mongoose.Types.ObjectId.isValid(donationId)) {
			return res
				.status(400)
				.json({ success: false, message: "Valid donation ID is required" });
		}

		const donation = await Donation.findById(donationId)
			.populate("donor", "email")
			.populate("organization", "name email");
		if (!donation)
			return res
				.status(404)
				.json({ success: false, message: "Donation not found" });

		const organization = await Organization.findOne({
			_id: donation?.organization._id,
			userId: req.user._id,
		});
		if (!organization)
			return res
				.status(403)
				.json({
					success: false,
					message: "You do not have permission to update this donation",
				});

		if (donation.status !== DonationStatus.RECEIVED) {
			return res
				.status(400)
				.json({
					success: false,
					message: "Only received donations can be marked as confirmed",
				});
		}

		// Generate PDF receipt
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
			// Continue with the process even if PDF generation fails
		}

		donation.status = DonationStatus.CONFIRMED;
		donation.confirmationDate = new Date();
		if (pdfReceiptUrl) donation.pdfReceiptUrl = pdfReceiptUrl;

		if (!donation.receiptImageMetadata) donation.receiptImageMetadata = {};
		donation.receiptImageMetadata.confirmedAt = new Date();
		donation.receiptImageMetadata.confirmedBy = new mongoose.Types.ObjectId(
			req.user._id
		);

		await donation.save();

		// Send email
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
					undefined,
					pdfReceiptUrl
				);
				emailStatus = "Email sent successfully to donor with receipt";
			} catch {
				emailStatus = "Failed to send email to donor";
			}
		} else {
			emailStatus = "No donor email provided";
		}

		// Send notification
		const notificationStatus = donation.donor?._id
			? await sendNotification(
					req as any,
					donation.donor._id.toString(),
					"status",
					{
						donationId: donation._id.toString(),
						status: DonationStatus.CONFIRMED,
						organizationName:
							(donation.organization as any)?.name || "Organization",
						cause: (donation.cause as any)?.title || "Unknown cause",
					}
				)
			: "No donor ID provided";

		res.status(200).json({
			success: true,
			data: donation,
			message: "Donation marked as confirmed with PDF receipt auto-generated",
			emailStatus,
			notificationStatus,
			pdfReceiptUrl: pdfReceiptUrl || null,
		});
	} catch (error: any) {
		res
			.status(500)
			.json({
				success: false,
				message: "Error marking donation as confirmed",
				error: error?.message || "Unknown error occurred",
			});
	}
};
