import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { ICampaign } from "../types/campaign";
import { DonationType } from "../types";
interface AuthRequest extends Omit<Request, "user"> {
	user?: IUser;
}

// Helper function to calculate campaign totals with separate money and item tracking
const calculateCampaignTotals = async (campaignId: string) => {
	try {
		// Get all donations for causes in this campaign
		const campaign = await Campaign.findById(campaignId).populate("causes");
		if (!campaign) {
			return {
				totalRaisedAmount: 0,
				totalItemDonations: 0,
				totalSupporters: 0,
			};
		}

		const causeIds = campaign.causes.map((cause: any) => cause._id);

		// Calculate money donations
		const moneyResult = await Donation.aggregate([
			{
				$match: {
					cause: { $in: causeIds },
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
					type: "MONEY",
				},
			},
			{
				$group: {
					_id: null,
					totalRaisedAmount: { $sum: "$amount" },
				},
			},
		]);

		// Calculate item donations
		const itemResult = await Donation.aggregate([
			{
				$match: {
					cause: { $in: causeIds },
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
					type: { $ne: "MONEY" },
				},
			},
			{
				$group: {
					_id: null,
					totalItemDonations: { $sum: { $ifNull: ["$quantity", 1] } },
				},
			},
		]);

		// Calculate unique supporters (both money and items)
		const uniqueDonors = await Donation.distinct("donor", {
			cause: { $in: causeIds },
			status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
		});

		return {
			totalRaisedAmount:
				moneyResult.length > 0 ? moneyResult[0].totalRaisedAmount || 0 : 0,
			totalItemDonations:
				itemResult.length > 0 ? itemResult[0].totalItemDonations || 0 : 0,
			totalSupporters: uniqueDonors.length,
		};
	} catch (error) {
		return { totalRaisedAmount: 0, totalItemDonations: 0, totalSupporters: 0 };
	}
};

// Helper function to format campaign response
const formatCampaignResponse = async (
	campaign: ICampaign & { _id: mongoose.Types.ObjectId }
) => {
	// Calculate real-time totals from donations with separate tracking
	const { totalRaisedAmount, totalItemDonations, totalSupporters } =
		await calculateCampaignTotals(campaign._id.toString());

	// Extract organization info from the first organization (assuming single org per campaign for now)
	const firstOrg =
		Array.isArray(campaign.organizations) && campaign.organizations.length > 0
			? campaign.organizations[0]
			: null;

	return {
		id: campaign._id.toString(),
		title: campaign.title,
		description: campaign.description,
		startDate: campaign.startDate.toISOString(),
		endDate: campaign.endDate.toISOString(),
		status: campaign.status,
		causes: campaign.causes, // Populated by Mongoose
		organizationId: firstOrg
			? (firstOrg._id || firstOrg.id || firstOrg).toString()
			: "",
		organizationName:
			firstOrg && typeof firstOrg === "object" && "name" in firstOrg
				? (firstOrg as any).name || "Unknown Organization"
				: "Unknown Organization",
		totalTargetAmount: campaign.totalTargetAmount,
		totalRaisedAmount: totalRaisedAmount, // Money raised
		totalItemDonations: totalItemDonations, // Items donated
		donorCount: totalSupporters, // Total unique donors
		imageUrl: campaign.imageUrl,
		acceptedDonationTypes: campaign.acceptedDonationTypes,
		createdAt: campaign.createdAt.toISOString(),
		updatedAt: campaign.updatedAt.toISOString(),
	};
};

// Get all campaigns with pagination and filters
export const getCampaigns = catchAsync(async (req: Request, res: Response) => {
	const {
		search,
		status,
		organization,
		organizations,
		cause,
		tag,
		startDate,
		endDate,
		page = "1",
		limit = "10",
		sortBy = "createdAt",
		sortOrder = "desc",
	} = req.query;

	const query: any = {};

	// Handle text search
	if (search) {
		query.$text = { $search: search as string };
	}

	// Handle status filter
	if (status && status !== "all") {
		query.status = status;
	}

	// Handle organization filter - check for specific organization
	if (organization) {
		query.organizations = organization;
	}
	if (organizations) {
		query.organizations = { $in: [organizations] };
	}
	if (cause) {
		query.causes = cause;
	}

	// Handle tag filter
	if (tag) {
		query.tags = tag;
	}

	// Handle date filter
	if (startDate || endDate) {
		query.startDate = {};
		if (startDate) query.startDate.$gte = new Date(startDate as string);
		if (endDate) query.startDate.$lte = new Date(endDate as string);
	}

	const sort: any = {};
	sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

	const skip = (Number(page) - 1) * Number(limit);

	const [campaigns, total] = await Promise.all([
		Campaign.find(query)
			.populate("organizations", "name email phone")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			) // Added donationItems and acceptanceType
			.sort(sort)
			.skip(skip)
			.limit(Number(limit)),
		Campaign.countDocuments(query),
	]);

	// Format campaigns with calculated totals
	const formattedCampaigns = await Promise.all(
		campaigns.map((campaign) => formatCampaignResponse(campaign))
	);

	res.status(200).json({
		success: true,
		data: formattedCampaigns,
		pagination: {
			total,
			page: Number(page),
			pages: Math.ceil(total / Number(limit)),
		},
	});
});

// Get a single campaign by ID
export const getCampaignById = catchAsync(
	async (req: Request, res: Response) => {
		const { campaignId } = req.params;

		const campaign = await Campaign.findById(campaignId)
			.populate("organizations", "name email phone address")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			); // Added donationItems and acceptanceType

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		const formattedCampaign = await formatCampaignResponse(campaign);

		res.status(200).json({
			success: true,
			data: formattedCampaign,
		});
	}
);

// Get campaign details with donation statistics
export const getCampaignDetails = catchAsync(
	async (req: Request, res: Response) => {
		try {
			const { campaignId } = req.params;

			const campaign = await Campaign.findById(campaignId)
				.populate("organizations", "name email phone address")
				.populate(
					"causes",
					"title description targetAmount donationItems acceptanceType"
				); // Added donationItems and acceptanceType

			if (!campaign) {
				throw new AppError("Campaign not found", 404);
			}

			const donationStats = await Donation.aggregate([
				{
					$match: {
						campaign: new mongoose.Types.ObjectId(campaignId),
						status: { $ne: "CANCELLED" },
					},
				},
				{
					$group: {
						_id: "$type",
						totalAmount: { $sum: "$amount" },
						count: { $sum: 1 },
					},
				},
			]);

			const formattedCampaign = await formatCampaignResponse(campaign);

			res.status(200).json({
				success: true,
				data: {
					campaign: formattedCampaign,
					donationStats,
				},
			});
		} catch (err) {
			throw err;
		}
	}
);

// Create a new campaign
export const createCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can create campaigns",
				403
			);
		}

		const {
			title,
			description,
			causes,
			acceptedDonationTypes,
			startDate,
			endDate,
			totalTargetAmount,
			imageUrl,
			status,
			organizations,
		} = req.body;

		if (
			!title ||
			!description ||
			!causes?.length ||
			!acceptedDonationTypes?.length ||
			!startDate ||
			!endDate ||
			totalTargetAmount === undefined
		) {
			throw new AppError("Missing required fields", 400);
		}

		// Check if campaign accepts money donations
		const acceptsMoney = acceptedDonationTypes.includes(DonationType.MONEY);

		// For campaigns that accept money, totalTargetAmount must be > 0
		// For items-only campaigns, totalTargetAmount can be 0
		if (acceptsMoney && totalTargetAmount <= 0) {
			throw new AppError(
				"Target amount must be greater than 0 for campaigns accepting money donations",
				400
			);
		}

		// For any campaign, totalTargetAmount cannot be negative
		if (totalTargetAmount < 0) {
			throw new AppError("Target amount cannot be negative", 400);
		}

		const start = new Date(startDate);
		const end = new Date(endDate);
		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			throw new AppError("Invalid date format", 400);
		}
		if (start >= end) {
			throw new AppError("End date must be after start date", 400);
		}

		const validDonationTypes = Object.values(DonationType);
		const invalidTypes = acceptedDonationTypes.filter(
			(type: string) => !validDonationTypes.includes(type as any)
		);
		if (invalidTypes.length > 0) {
			throw new AppError(
				`Invalid donation types: ${invalidTypes.join(", ")}`,
				400
			);
		}

		if (
			status &&
			!["draft", "active", "completed", "cancelled"].includes(status)
		) {
			throw new AppError("Invalid status", 400);
		}

		const campaign = await Campaign.create({
			title,
			description,
			causes,
			acceptedDonationTypes,
			startDate: start,
			endDate: end,
			organizations, // Use organizations array from request
			totalTargetAmount,
			imageUrl: imageUrl || "https://placehold.co/600x400?text=Campaign",
			status: status || "draft",
			// totalRaisedAmount and totalSupporters removed - calculated dynamically
		});

		await campaign.populate({
			path: "causes",
			select: "title description targetAmount donationItems acceptanceType", // Added donationItems and acceptanceType
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		const formattedCampaign = await formatCampaignResponse(campaign);

		res.status(201).json({
			success: true,
			data: formattedCampaign,
		});
	}
);

// Update an existing campaign
export const updateCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can update campaigns",
				403
			);
		}

		const { campaignId } = req.params;

		const campaign = await Campaign.findById(campaignId);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		const {
			title,
			description,
			startDate,
			endDate,
			totalTargetAmount,
			imageUrl,
			acceptedDonationTypes,
			status,
			causes,
		} = req.body;

		if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
			throw new AppError("End date must be after start date", 400);
		}

		if (totalTargetAmount !== undefined) {
			// Check if campaign accepts money donations
			const campaignAcceptedTypes =
				acceptedDonationTypes || campaign.acceptedDonationTypes;
			const acceptsMoney = campaignAcceptedTypes.includes(DonationType.MONEY);

			// For campaigns that accept money, totalTargetAmount must be > 0
			// For items-only campaigns, totalTargetAmount can be 0
			if (acceptsMoney && totalTargetAmount <= 0) {
				throw new AppError(
					"Target amount must be greater than 0 for campaigns accepting money donations",
					400
				);
			}

			// For any campaign, totalTargetAmount cannot be negative
			if (totalTargetAmount < 0) {
				throw new AppError("Target amount cannot be negative", 400);
			}
		}

		if (acceptedDonationTypes) {
			if (
				!Array.isArray(acceptedDonationTypes) ||
				acceptedDonationTypes.length === 0
			) {
				throw new AppError("At least one donation type must be specified", 400);
			}
			const validDonationTypes = Object.values(DonationType);
			const invalidTypes = acceptedDonationTypes.filter(
				(type: string) => !validDonationTypes.includes(type as any)
			);
			if (invalidTypes.length > 0) {
				throw new AppError(
					`Invalid donation types: ${invalidTypes.join(", ")}`,
					400
				);
			}
		}

		if (
			status &&
			!["draft", "active", "completed", "cancelled"].includes(status)
		) {
			throw new AppError("Invalid status", 400);
		}

		if (causes) {
			const validCauses = await Cause.find({
				_id: { $in: causes },
				organizationId: req.user._id,
			});
		}

		campaign.set({
			title: title || campaign.title,
			description: description || campaign.description,
			startDate: startDate ? new Date(startDate) : campaign.startDate,
			endDate: endDate ? new Date(endDate) : campaign.endDate,
			totalTargetAmount:
				totalTargetAmount !== undefined
					? totalTargetAmount
					: campaign.totalTargetAmount,
			imageUrl: imageUrl || campaign.imageUrl,
			acceptedDonationTypes:
				acceptedDonationTypes || campaign.acceptedDonationTypes,
			status: status || campaign.status,
			causes: causes || campaign.causes,
		});

		await campaign.save();

		await campaign.populate({
			path: "causes",
			select: "title description targetAmount donationItems acceptanceType", // Added donationItems and acceptanceType
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		const formattedCampaign = await formatCampaignResponse(campaign);

		res.status(200).json({
			success: true,
			data: formattedCampaign,
		});
	}
);

// Delete a campaign
export const deleteCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		try {
			// Check authorization
			if (!req.user || req.user.role !== "organization") {
				throw new AppError(
					"Unauthorized: Only organizations can delete campaigns",
					403
				);
			}

			const { campaignId } = req.params;

			// Find the campaign
			const campaign = await Campaign.findById(campaignId);
			if (!campaign) {
				throw new AppError("Campaign not found", 404);
			}

			// Check if user has permission to delete
			const userIdForDelete = req.user!._id.toString();

			const hasPermission = campaign.organizations.some(
				(orgId) => orgId.toString() === userIdForDelete
			);

			if (!hasPermission) {
				throw new AppError(
					"Unauthorized: You do not have permission to delete this campaign",
					403
				);
			}

			// If it does, prevent deletion or mark as cancelled instead
			const donations = await Donation.countDocuments({ campaign: campaignId });
			if (donations > 0) {
				campaign.status = "cancelled";
				await campaign.save();
				return res.status(200).json({
					success: true,
					message:
						"Campaign has existing donations and cannot be deleted. It has been marked as cancelled instead.",
				});
			}

			// Delete the campaign
			const result = await campaign.deleteOne();

			// Return success response with detailed message
			return res.status(200).json({
				success: true,
				message: "Campaign successfully deleted",
				data: { id: campaignId },
			});
		} catch (error) {
			// This catch block will be handled by the catchAsync wrapper

			throw error;
		}
	}
);

// Add a cause to a campaign
export const addCauseToCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can modify campaigns",
				403
			);
		}

		const { campaignId } = req.params;
		const { causeId } = req.body;

		const [campaign, cause] = await Promise.all([
			Campaign.findById(campaignId),
			Cause.findById(causeId),
		]);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		if (!cause) {
			throw new AppError("Cause not found", 404);
		}

		const userIdForAdd = req.user!._id;
		if (
			!campaign.organizations.some((orgId) => orgId.toString() === userIdForAdd)
		) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		if (cause.organizationId.toString() !== req.user._id) {
			throw new AppError("Cause does not belong to your organization", 403);
		}

		if (campaign.causes.includes(causeId)) {
			throw new AppError("Cause already added to campaign", 400);
		}

		campaign.causes.push(causeId);
		await campaign.save();

		await campaign.populate({
			path: "causes",
			select: "title description targetAmount donationItems acceptanceType", // Added donationItems and acceptanceType
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		const formattedCampaign = await formatCampaignResponse(campaign);

		res.status(200).json({
			success: true,
			data: formattedCampaign,
		});
	}
);

// Remove a cause from a campaign
export const removeCauseFromCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can modify campaigns",
				403
			);
		}

		const { campaignId, causeId } = req.params;

		const campaign = await Campaign.findById(campaignId);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		const userIdForRemove = req.user!._id;
		if (
			!campaign.organizations.some(
				(orgId) => orgId.toString() === userIdForRemove
			)
		) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		if (!campaign.causes.includes(causeId as any)) {
			throw new AppError("Cause not found in campaign", 400);
		}

		campaign.causes = campaign.causes.filter((id) => id.toString() !== causeId);
		await campaign.save();

		await campaign.populate({
			path: "causes",
			select: "title description targetAmount donationItems acceptanceType", // Added donationItems and acceptanceType
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		const formattedCampaign = await formatCampaignResponse(campaign);

		res.status(200).json({
			success: true,
			data: formattedCampaign,
		});
	}
);

// Get campaign details with comprehensive donation data
export const getCampaignDetailsWithDonations = catchAsync(
	async (req: Request, res: Response) => {
		const { campaignId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(campaignId)) {
			throw new AppError("Invalid campaign ID", 400);
		}

		// Get campaign with populated causes and organizations
		const campaign = await Campaign.findById(campaignId)
			.populate("organizations", "name email phone address")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		// Get all donations for this campaign
		const campaignDonations = await Donation.find({
			campaign: campaignId,
			status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] }, // Only count confirmed donations
		}).populate("donor", "name email");

		// Calculate campaign-level statistics
		const totalRaisedAmount = campaignDonations
			.filter((donation) => donation.type === DonationType.MONEY)
			.reduce((sum, donation) => sum + (donation.amount || 0), 0);

		const uniqueDonors = new Set(
			campaignDonations.map((d) => d.donor.toString())
		);
		const donorCount = uniqueDonors.size;

		// Calculate cause-level statistics
		const causesWithStats = await Promise.all(
			campaign.causes.map(async (cause: any) => {
				// Get donations for this specific cause
				const causeDonations = await Donation.find({
					cause: cause._id,
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
				}).populate("donor", "name email");

				// Calculate raised amount for this cause
				const causeRaisedAmount = causeDonations
					.filter((donation) => donation.type === DonationType.MONEY)
					.reduce((sum, donation) => sum + (donation.amount || 0), 0);

				// Calculate progress percentage
				const progressPercentage =
					cause.targetAmount > 0
						? Math.min((causeRaisedAmount / cause.targetAmount) * 100, 100)
						: 0;

				// Get unique donors for this cause
				const causeDonors = new Set(
					causeDonations.map((d) => d.donor.toString())
				);
				const causeDonorCount = causeDonors.size;

				// Get item donations for this cause
				const itemDonations = causeDonations.filter(
					(donation) => donation.type !== DonationType.MONEY
				);

				return {
					...cause.toObject(),
					raisedAmount: causeRaisedAmount,
					progressPercentage: Math.round(progressPercentage * 10) / 10, // Round to 1 decimal
					donorCount: causeDonorCount,
					totalDonations: causeDonations.length,
					itemDonationsCount: itemDonations.length,
					recentDonations: causeDonations
						.sort(
							(a, b) =>
								new Date(b.createdAt).getTime() -
								new Date(a.createdAt).getTime()
						)
						.slice(0, 5) // Get 5 most recent donations
						.map((donation) => ({
							id: donation._id,
							donor: donation.donor,
							type: donation.type,
							amount: donation.amount,
							description: donation.description,
							status: donation.status,
							createdAt: donation.createdAt,
						})),
				};
			})
		);

		// Calculate aggregated donation items from all causes
		const allDonationItems = campaign.causes
			.filter(
				(cause: any) => cause.donationItems && cause.donationItems.length > 0
			)
			.flatMap((cause: any) => cause.donationItems || [])
			.filter(
				(item: string, index: number, array: string[]) =>
					array.indexOf(item) === index
			);

		// Get recent campaign donations
		const recentCampaignDonations = campaignDonations
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			)
			.slice(0, 10)
			.map((donation) => ({
				id: donation._id,
				donor: donation.donor,
				type: donation.type,
				amount: donation.amount,
				description: donation.description,
				status: donation.status,
				createdAt: donation.createdAt,
			}));

		// Calculate days remaining
		const today = new Date();
		const endDate = new Date(campaign.endDate);
		const daysRemaining = Math.max(
			0,
			Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
		);

		// Calculate progress percentage for campaign
		const campaignProgress =
			campaign.totalTargetAmount > 0
				? Math.min((totalRaisedAmount / campaign.totalTargetAmount) * 100, 100)
				: 0;

		const response = {
			campaign: {
				...campaign.toObject(),
				totalRaisedAmount,
				donorCount,
				progressPercentage: Math.round(campaignProgress * 10) / 10,
				daysRemaining,
				allDonationItems,
				causes: causesWithStats,
			},
			statistics: {
				totalDonations: campaignDonations.length,
				totalMoneyDonations: campaignDonations.filter(
					(d) => d.type === DonationType.MONEY
				).length,
				totalItemDonations: campaignDonations.filter(
					(d) => d.type !== DonationType.MONEY
				).length,
				averageDonationAmount:
					campaignDonations.filter((d) => d.type === DonationType.MONEY)
						.length > 0
						? totalRaisedAmount /
						campaignDonations.filter((d) => d.type === DonationType.MONEY)
							.length
						: 0,
				causesWithProgress: causesWithStats.filter(
					(cause) => cause.progressPercentage > 0
				).length,
				causesCompleted: causesWithStats.filter(
					(cause) => cause.progressPercentage >= 100
				).length,
			},
			recentActivity: recentCampaignDonations,
		};

		res.status(200).json({
			status: "success",
			data: response,
		});
	}
);
