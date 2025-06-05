import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";
import Donation, { DonationType } from "../models/donation.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";

interface AuthRequest extends Omit<Request, "user"> {
	user?: IUser;
}

// Helper to calculate campaign totals
const calculateTotals = async (campaignId: string) => {
	try {
		const campaign = await Campaign.findById(campaignId).populate("causes");
		if (!campaign)
			return {
				totalRaisedAmount: 0,
				totalItemDonations: 0,
				totalSupporters: 0,
			};

		const causeIds = campaign.causes.map((cause: any) => cause._id);
		const [moneyResult, itemResult, uniqueDonors] = await Promise.all([
			Donation.aggregate([
				{
					$match: {
						cause: { $in: causeIds },
						status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
						type: "MONEY",
					},
				},
				{ $group: { _id: null, totalRaisedAmount: { $sum: "$amount" } } },
			]),
			Donation.aggregate([
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
			]),
			Donation.distinct("donor", {
				cause: { $in: causeIds },
				status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
			}),
		]);

		return {
			totalRaisedAmount: moneyResult[0]?.totalRaisedAmount || 0,
			totalItemDonations: itemResult[0]?.totalItemDonations || 0,
			totalSupporters: uniqueDonors.length,
		};
	} catch (error) {
		return { totalRaisedAmount: 0, totalItemDonations: 0, totalSupporters: 0 };
	}
};

// Helper to format campaign response
const formatResponse = async (campaign: any) => {
	const { totalRaisedAmount, totalItemDonations, totalSupporters } =
		await calculateTotals(campaign._id.toString());
	const firstOrg = campaign.organizations?.[0];

	return {
		id: campaign._id.toString(),
		title: campaign.title,
		description: campaign.description,
		startDate: campaign.startDate.toISOString(),
		endDate: campaign.endDate.toISOString(),
		status: campaign.status,
		causes: campaign.causes,
		organizationId: firstOrg
			? (firstOrg._id || firstOrg.id || firstOrg).toString()
			: "",
		organizationName: firstOrg?.name || "Unknown Organization",
		totalTargetAmount: campaign.totalTargetAmount,
		totalRaisedAmount,
		totalItemDonations,
		donorCount: totalSupporters,
		imageUrl: campaign.imageUrl,
		acceptedDonationTypes: campaign.acceptedDonationTypes,
		createdAt: campaign.createdAt.toISOString(),
		updatedAt: campaign.updatedAt.toISOString(),
	};
};

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
	if (search) query.$text = { $search: search as string };
	if (status && status !== "all") query.status = status;
	if (organization) query.organizations = organization;
	if (organizations) query.organizations = { $in: [organizations] };
	if (cause) query.causes = cause;
	if (tag) query.tags = tag;
	if (startDate || endDate) {
		query.startDate = {};
		if (startDate) query.startDate.$gte = new Date(startDate as string);
		if (endDate) query.startDate.$lte = new Date(endDate as string);
	}

	const sort: any = {};
	sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

	const [campaigns, total] = await Promise.all([
		Campaign.find(query)
			.populate("organizations", "name email phone")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			)
			.sort(sort)
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit)),
		Campaign.countDocuments(query),
	]);

	const formattedCampaigns = await Promise.all(
		campaigns.map((campaign) => formatResponse(campaign))
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

export const getCampaignById = catchAsync(
	async (req: Request, res: Response) => {
		const campaign = await Campaign.findById(req.params.campaignId)
			.populate("organizations", "name email phone address")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			);

		if (!campaign) throw new AppError("Campaign not found", 404);

		res
			.status(200)
			.json({ success: true, data: await formatResponse(campaign) });
	}
);

export const getCampaignDetails = catchAsync(
	async (req: Request, res: Response) => {
		const { campaignId } = req.params;

		const campaign = await Campaign.findById(campaignId)
			.populate("organizations", "name email phone address")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			);

		if (!campaign) throw new AppError("Campaign not found", 404);

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

		res.status(200).json({
			success: true,
			data: { campaign: await formatResponse(campaign), donationStats },
		});
	}
);

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

		const acceptsMoney = acceptedDonationTypes.includes(DonationType.MONEY);
		if (acceptsMoney && totalTargetAmount <= 0) {
			throw new AppError(
				"Target amount must be greater than 0 for campaigns accepting money donations",
				400
			);
		}
		if (totalTargetAmount < 0)
			throw new AppError("Target amount cannot be negative", 400);

		const start = new Date(startDate);
		const end = new Date(endDate);
		if (isNaN(start.getTime()) || isNaN(end.getTime()))
			throw new AppError("Invalid date format", 400);
		if (start >= end)
			throw new AppError("End date must be after start date", 400);

		const validDonationTypes = Object.values(DonationType);
		const invalidTypes = acceptedDonationTypes.filter(
			(type: string) => !validDonationTypes.includes(type as any)
		);
		if (invalidTypes.length > 0)
			throw new AppError(
				`Invalid donation types: ${invalidTypes.join(", ")}`,
				400
			);

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
			organizations,
			totalTargetAmount,
			imageUrl: imageUrl || "https://placehold.co/600x400?text=Campaign",
			status: status || "draft",
		});

		await campaign.populate(
			"causes",
			"title description targetAmount donationItems acceptanceType"
		);
		await campaign.populate("organizations", "name email phone");

		res
			.status(201)
			.json({ success: true, data: await formatResponse(campaign) });
	}
);

export const updateCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can update campaigns",
				403
			);
		}

		const campaign = await Campaign.findById(req.params.campaignId);
		if (!campaign) throw new AppError("Campaign not found", 404);

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
			const campaignAcceptedTypes =
				acceptedDonationTypes || campaign.acceptedDonationTypes;
			const acceptsMoney = campaignAcceptedTypes.includes(DonationType.MONEY);
			if (acceptsMoney && totalTargetAmount <= 0) {
				throw new AppError(
					"Target amount must be greater than 0 for campaigns accepting money donations",
					400
				);
			}
			if (totalTargetAmount < 0)
				throw new AppError("Target amount cannot be negative", 400);
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
			if (invalidTypes.length > 0)
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
		await campaign.populate(
			"causes",
			"title description targetAmount donationItems acceptanceType"
		);
		await campaign.populate("organizations", "name email phone");

		res
			.status(200)
			.json({ success: true, data: await formatResponse(campaign) });
	}
);

export const deleteCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can delete campaigns",
				403
			);
		}

		const campaign = await Campaign.findById(req.params.campaignId);
		if (!campaign) throw new AppError("Campaign not found", 404);

		const hasPermission = campaign.organizations.some(
			(orgId) => orgId.toString() === req.user!._id.toString()
		);
		if (!hasPermission) {
			throw new AppError(
				"Unauthorized: You do not have permission to delete this campaign",
				403
			);
		}

		const donations = await Donation.countDocuments({
			campaign: req.params.campaignId,
		});
		if (donations > 0) {
			campaign.status = "cancelled";
			await campaign.save();
			return res.status(200).json({
				success: true,
				message:
					"Campaign has existing donations and cannot be deleted. It has been marked as cancelled instead.",
			});
		}

		await campaign.deleteOne();
		res.status(200).json({
			success: true,
			message: "Campaign successfully deleted",
			data: { id: req.params.campaignId },
		});
	}
);

export const addCauseToCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can modify campaigns",
				403
			);
		}

		const [campaign, cause] = await Promise.all([
			Campaign.findById(req.params.campaignId),
			Cause.findById(req.body.causeId),
		]);

		if (!campaign) throw new AppError("Campaign not found", 404);
		if (!cause) throw new AppError("Cause not found", 404);

		if (
			!campaign.organizations.some(
				(orgId) => orgId.toString() === req.user!._id
			)
		) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		if (cause.organizationId.toString() !== req.user._id) {
			throw new AppError("Cause does not belong to your organization", 403);
		}

		if (campaign.causes.includes(req.body.causeId)) {
			throw new AppError("Cause already added to campaign", 400);
		}

		campaign.causes.push(req.body.causeId);
		await campaign.save();
		await campaign.populate(
			"causes",
			"title description targetAmount donationItems acceptanceType"
		);
		await campaign.populate("organizations", "name email phone");

		res
			.status(200)
			.json({ success: true, data: await formatResponse(campaign) });
	}
);

export const removeCauseFromCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can modify campaigns",
				403
			);
		}

		const campaign = await Campaign.findById(req.params.campaignId);
		if (!campaign) throw new AppError("Campaign not found", 404);

		if (
			!campaign.organizations.some(
				(orgId) => orgId.toString() === req.user!._id
			)
		) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		if (!campaign.causes.includes(req.params.causeId as any)) {
			throw new AppError("Cause not found in campaign", 400);
		}

		campaign.causes = campaign.causes.filter(
			(id) => id.toString() !== req.params.causeId
		);
		await campaign.save();
		await campaign.populate(
			"causes",
			"title description targetAmount donationItems acceptanceType"
		);
		await campaign.populate("organizations", "name email phone");

		res
			.status(200)
			.json({ success: true, data: await formatResponse(campaign) });
	}
);

export const getCampaignDetailsWithDonations = catchAsync(
	async (req: Request, res: Response) => {
		const { campaignId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(campaignId))
			throw new AppError("Invalid campaign ID", 400);

		const campaign = await Campaign.findById(campaignId)
			.populate("organizations", "name email phone address")
			.populate(
				"causes",
				"title description targetAmount donationItems acceptanceType"
			);

		if (!campaign) throw new AppError("Campaign not found", 404);

		const campaignDonations = await Donation.find({
			campaign: campaignId,
			status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
		}).populate("donor", "name email");

		const totalRaisedAmount = campaignDonations
			.filter((d) => d.type === DonationType.MONEY)
			.reduce((sum, d) => sum + (d.amount || 0), 0);

		const donorCount = new Set(campaignDonations.map((d) => d.donor.toString()))
			.size;

		const causesWithStats = await Promise.all(
			campaign.causes.map(async (cause: any) => {
				const causeDonations = await Donation.find({
					cause: cause._id,
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
				}).populate("donor", "name email");

				const causeRaisedAmount = causeDonations
					.filter((d) => d.type === DonationType.MONEY)
					.reduce((sum, d) => sum + (d.amount || 0), 0);

				const progressPercentage =
					cause.targetAmount > 0
						? Math.min((causeRaisedAmount / cause.targetAmount) * 100, 100)
						: 0;

				return {
					...cause.toObject(),
					raisedAmount: causeRaisedAmount,
					progressPercentage: Math.round(progressPercentage * 10) / 10,
					donorCount: new Set(causeDonations.map((d) => d.donor.toString()))
						.size,
					totalDonations: causeDonations.length,
					itemDonationsCount: causeDonations.filter(
						(d) => d.type !== DonationType.MONEY
					).length,
					recentDonations: causeDonations
						.sort(
							(a, b) =>
								new Date(b.createdAt).getTime() -
								new Date(a.createdAt).getTime()
						)
						.slice(0, 5)
						.map((d) => ({
							id: d._id,
							donor: d.donor,
							type: d.type,
							amount: d.amount,
							description: d.description,
							status: d.status,
							createdAt: d.createdAt,
						})),
				};
			})
		);

		const allDonationItems = campaign.causes
			.filter((cause: any) => cause.donationItems?.length > 0)
			.flatMap((cause: any) => cause.donationItems || [])
			.filter(
				(item: string, index: number, array: string[]) =>
					array.indexOf(item) === index
			);

		const recentCampaignDonations = campaignDonations
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			)
			.slice(0, 10)
			.map((d) => ({
				id: d._id,
				donor: d.donor,
				type: d.type,
				amount: d.amount,
				description: d.description,
				status: d.status,
				createdAt: d.createdAt,
			}));

		const daysRemaining = Math.max(
			0,
			Math.ceil(
				(new Date(campaign.endDate).getTime() - new Date().getTime()) /
					(1000 * 60 * 60 * 24)
			)
		);
		const campaignProgress =
			campaign.totalTargetAmount > 0
				? Math.min((totalRaisedAmount / campaign.totalTargetAmount) * 100, 100)
				: 0;

		const moneyDonations = campaignDonations.filter(
			(d) => d.type === DonationType.MONEY
		);

		res.status(200).json({
			status: "success",
			data: {
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
					totalMoneyDonations: moneyDonations.length,
					totalItemDonations: campaignDonations.filter(
						(d) => d.type !== DonationType.MONEY
					).length,
					averageDonationAmount:
						moneyDonations.length > 0
							? totalRaisedAmount / moneyDonations.length
							: 0,
					causesWithProgress: causesWithStats.filter(
						(cause) => cause.progressPercentage > 0
					).length,
					causesCompleted: causesWithStats.filter(
						(cause) => cause.progressPercentage >= 100
					).length,
				},
				recentActivity: recentCampaignDonations,
			},
		});
	}
);
