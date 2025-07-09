import { Response } from "express";
import mongoose from "mongoose";
import Donation from "../models/donation.model";
import Organization from "../models/organization.model";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";
import {
	AuthRequest,
	DashboardStatsResponse,
	DonationStats,
	CampaignStats,
	CauseStats,
} from "../types/dashboard";
import { DonationStatus, DonationType } from "../types";
// Helper functions
const calculateGrowthPercentage = (
	current: number,
	previous: number
): number => {
	return previous === 0 ? 100 : ((current - previous) / previous) * 100;
};

const calculateImpactScore = (
	totalDonations: number,
	donationCount: number
): number => {
	return Math.min(
		100,
		Math.floor((totalDonations / 1000) * 10 + donationCount * 5)
	);
};

const calculateImpactPercentile = async (): Promise<number> => {
	const allDonors = await Donation.distinct("donor");
	return Math.floor(((allDonors.length - 1) / allDonors.length) * 100);
};

const getMonthlyDonationTrends = async (matchQuery: object) => {
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

	return Donation.aggregate([
		{
			$match: {
				...matchQuery,
				type: DonationType.MONEY,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
				createdAt: { $gte: sixMonthsAgo },
			},
		},
		{
			$group: {
				_id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
				amount: { $sum: "$amount" },
				count: { $sum: 1 },
			},
		},
		{ $sort: { "_id.year": 1, "_id.month": 1 } },
	]);
};

const getDonationsByType = async (matchQuery: object) => {
	return Donation.aggregate([
		{
			$match: {
				...matchQuery,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			},
		},
		{
			$group: {
				_id: "$type",
				count: { $sum: 1 },
				totalAmount: {
					$sum: {
						$cond: [{ $eq: ["$type", DonationType.MONEY] }, "$amount", 0],
					},
				},
			},
		},
	]);
};

const getTopCauses = async (matchQuery: object) => {
	return Donation.aggregate([
		{
			$match: {
				...matchQuery,
				type: DonationType.MONEY,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
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
		{ $unwind: "$causeInfo" },
		{
			$group: {
				_id: "$cause",
				causeName: { $first: "$causeInfo.title" },
				totalAmount: { $sum: "$amount" },
				donationCount: { $sum: 1 },
			},
		},
		{ $sort: { totalAmount: -1 } },
		{ $limit: 5 },
	]);
};

const getTopDonors = async (organizationId: mongoose.Types.ObjectId) => {
	return Donation.aggregate([
		{
			$match: {
				organization: organizationId,
				type: DonationType.MONEY,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			},
		},
		{
			$lookup: {
				from: "users",
				localField: "donor",
				foreignField: "_id",
				as: "donorInfo",
			},
		},
		{ $unwind: "$donorInfo" },
		{
			$group: {
				_id: "$donor",
				firstName: { $first: "$donorInfo.firstName" },
				lastName: { $first: "$donorInfo.lastName" },
				donorEmail: { $first: "$donorInfo.email" },
				totalAmount: { $sum: "$amount" },
				donationCount: { $sum: 1 },
			},
		},
		{
			$project: {
				_id: 1,
				donorName: {
					$concat: [
						{ $ifNull: ["$firstName", ""] },
						" ",
						{ $ifNull: ["$lastName", ""] },
					],
				},
				donorEmail: 1,
				totalAmount: 1,
				donationCount: 1,
			},
		},
		{ $sort: { totalAmount: -1 } },
		{ $limit: 5 },
	]);
};

const getCampaignPerformance = async (
	organizationId: mongoose.Types.ObjectId
) => {
	return Campaign.aggregate([
		{
			$match: {
				organizations: organizationId,
				status: { $in: ["active", "completed"] },
			},
		},
		{
			$lookup: {
				from: "organizations",
				localField: "organizations",
				foreignField: "_id",
				as: "organizations",
			},
		},
		{
			$lookup: {
				from: "causes",
				localField: "causes",
				foreignField: "_id",
				as: "causes",
			},
		},
		{
			$project: {
				title: 1,
				description: 1,
				startDate: 1,
				endDate: 1,
				status: 1,
				imageUrl: 1,
				totalTargetAmount: 1,
				totalRaisedAmount: 1,
				totalSupporters: 1,
				organizations: {
					$map: {
						input: "$organizations",
						as: "org",
						in: { name: "$$org.name", id: "$$org._id", logo: "$$org.logo" },
					},
				},
				causes: {
					$map: {
						input: "$causes",
						as: "cause",
						in: { title: "$$cause.title", id: "$$cause._id" },
					},
				},
				daysRemaining: {
					$cond: [
						{
							$and: [
								{ $eq: ["$status", "active"] },
								{ $gte: ["$endDate", new Date()] },
							],
						},
						{
							$ceil: {
								$divide: [
									{ $subtract: ["$endDate", new Date()] },
									1000 * 60 * 60 * 24,
								],
							},
						},
						0,
					],
				},
				achievementRate: {
					$cond: [
						{ $eq: ["$totalTargetAmount", 0] },
						0,
						{
							$round: [
								{
									$multiply: [
										{ $divide: ["$totalRaisedAmount", "$totalTargetAmount"] },
										100,
									],
								},
								2,
							],
						},
					],
				},
			},
		},
		{ $sort: { achievementRate: -1 } },
		{ $limit: 5 },
	]);
};

// Controller functions
export const getDonorDashboardStats = async (
	req: AuthRequest,
	res: Response<DashboardStatsResponse>
) => {
	try {
		const donorId = req.user?._id;
		if (!donorId) {
			return res.status(401).json({ success: false, error: "Unauthorized" });
		}

		// Get total donations amount
		const [totalDonationsResult] = await Donation.aggregate([
			{
				$match: {
					donor: donorId,
					type: DonationType.MONEY,
					status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
				},
			},
			{ $group: { _id: null, total: { $sum: "$amount" } } },
		]);

		// Calculate donation growth
		const lastMonth = new Date();
		lastMonth.setMonth(lastMonth.getMonth() - 1);
		const twoMonthsAgo = new Date(lastMonth);
		twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1);

		const [lastMonthDonations, previousMonthDonations] = await Promise.all([
			Donation.aggregate([
				{
					$match: {
						donor: donorId,
						type: DonationType.MONEY,
						status: {
							$in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED],
						},
						createdAt: { $gte: lastMonth },
					},
				},
				{ $group: { _id: null, total: { $sum: "$amount" } } },
			]),
			Donation.aggregate([
				{
					$match: {
						donor: donorId,
						type: DonationType.MONEY,
						status: {
							$in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED],
						},
						createdAt: { $gte: twoMonthsAgo, $lt: lastMonth },
					},
				},
				{ $group: { _id: null, total: { $sum: "$amount" } } },
			]),
		]);

		const lastMonthTotal = lastMonthDonations[0]?.total || 0;
		const previousMonthTotal = previousMonthDonations[0]?.total || 0;
		const donationGrowth = calculateGrowthPercentage(
			lastMonthTotal,
			previousMonthTotal
		);

		// Get various statistics
		const [
			causesSupported,
			activeCategories,
			organizationsSupported,
			allDonationsCount,
			monthlyTrends,
			donationsByType,
			topCauses,
		] = await Promise.all([
			Donation.distinct("type", {
				donor: donorId,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			}),
			Donation.distinct("type", {
				donor: donorId,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
				createdAt: {
					$gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
				},
			}),
			Donation.distinct("organization", {
				donor: donorId,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			}),
			Donation.countDocuments({
				donor: donorId,
				status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			}),
			getMonthlyDonationTrends({ donor: donorId }),
			getDonationsByType({ donor: donorId }),
			getTopCauses({ donor: donorId }),
		]);

		// Get recent activity
		const recentActivity = await Donation.find({
			donor: donorId,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		})
			.sort({ createdAt: -1 })
			.limit(5)
			.populate("organization", "name")
			.lean();

		// Calculate impact metrics
		const impactScore = calculateImpactScore(
			totalDonationsResult?.total || 0,
			allDonationsCount
		);
		const impactPercentile = await calculateImpactPercentile();

		return res.json({
			success: true,
			data: {
				stats: {
					totalDonations: totalDonationsResult?.total || 0,
					donationGrowth: Math.round(donationGrowth * 100) / 100,
					causesSupported: causesSupported.length,
					activeCategories: activeCategories.length,
					impactScore,
					impactPercentile,
					organizationsCount: organizationsSupported.length,
					supportingOrganizations: organizationsSupported.length,
					totalDonationCount: allDonationsCount,
				},
				charts: {
					monthlyTrends: monthlyTrends.map((trend) => ({
						month: `${trend._id.year}-${String(trend._id.month).padStart(2, "0")}`,
						amount: trend.amount,
						count: trend.count,
					})),
					donationsByType: donationsByType.map((type) => ({
						type: type._id,
						count: type.count,
						amount: type.totalAmount,
					})),
					topCauses: topCauses.map((cause) => ({
						name: cause.causeName,
						amount: cause.totalAmount,
						count: cause.donationCount,
					})),
				},
				recentActivity: recentActivity.map((activity) => ({
					id: activity._id.toString(),
					type: "donation",
					amount: activity.amount,
					campaignName: activity.description,
					timestamp: activity.createdAt,
					organizationId: activity.organization?._id.toString() || "",
					organizationName: (activity.organization as any)?.name || "",
				})),
			},
		});
	} catch (error) {
		console.error("Error in getDonorDashboardStats:", error);
		return res.status(500).json({
			success: false,
			error: "Internal server error",
		});
	}
};

export const getOrganizationDashboardStats = async (
	req: AuthRequest,
	res: Response<DashboardStatsResponse>
) => {
	try {
		const userId = req.user?._id;
		if (!userId) {
			return res.status(401).json({ success: false, error: "Unauthorized" });
		}

		// Get organization ID from the authenticated user
		const organization = await Organization.findOne({ userId });
		if (!organization) {
			return res
				.status(404)
				.json({ success: false, error: "Organization not found" });
		}

		const organizationId = organization._id;

		// Get all statistics in parallel
		const [
			donationStats,
			campaignStats,
			causeStats,
			monthlyDonationTrends,
			donationsByType,
			topDonors,
			campaignPerformance,
			recentDonations,
			recentCampaigns,
		] = await Promise.all([
			// Donation stats
			Donation.aggregate<DonationStats>([
				{ $match: { organization: organizationId } },
				{
					$group: {
						_id: null,
						totalAmount: { $sum: "$amount" },
						totalDonations: { $sum: 1 },
						averageDonation: { $avg: "$amount" },
					},
				},
				{
					$project: {
						_id: 0,
						totalAmount: 1,
						totalDonations: 1,
						averageDonation: { $round: ["$averageDonation", 2] },
					},
				},
			]),
			// Campaign stats
			Campaign.aggregate<CampaignStats>([
				{
					$match: {
						organizations: organizationId,
						status: { $ne: "draft" },
					},
				},
				{
					$group: {
						_id: null,
						totalCampaigns: { $sum: 1 },
						activeCampaigns: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$status", "active"] },
											{ $lte: ["$startDate", new Date()] },
											{ $gte: ["$endDate", new Date()] },
										],
									},
									1,
									0,
								],
							},
						},
						completedCampaigns: {
							$sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
						},
						cancelledCampaigns: {
							$sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
						},
						totalTargetAmount: { $sum: "$totalTargetAmount" },
						totalRaisedAmount: { $sum: "$totalRaisedAmount" },
						avgSupporters: { $avg: "$totalSupporters" },
					},
				},
				{
					$project: {
						_id: 0,
						totalCampaigns: 1,
						activeCampaigns: 1,
						completedCampaigns: 1,
						cancelledCampaigns: 1,
						totalTargetAmount: 1,
						totalRaisedAmount: 1,
						avgSupporters: { $round: ["$avgSupporters", 1] },
						achievementRate: {
							$cond: [
								{ $eq: ["$totalTargetAmount", 0] },
								0,
								{
									$round: [
										{
											$multiply: [
												{
													$divide: ["$totalRaisedAmount", "$totalTargetAmount"],
												},
												100,
											],
										},
										1,
									],
								},
							],
						},
					},
				},
			]),
			// Cause stats
			Cause.aggregate<CauseStats>([
				{ $match: { organizationId } },
				{
					$group: {
						_id: null,
						totalCauses: { $sum: 1 },
						totalTargetAmount: { $sum: "$targetAmount" },
						totalRaisedAmount: { $sum: "$raisedAmount" },
					},
				},
				{
					$project: {
						_id: 0,
						totalCauses: 1,
						totalTargetAmount: 1,
						totalRaisedAmount: 1,
						achievementRate: {
							$round: [
								{
									$multiply: [
										{ $divide: ["$totalRaisedAmount", "$totalTargetAmount"] },
										100,
									],
								},
								1,
							],
						},
					},
				},
			]),

			getMonthlyDonationTrends({ organization: organizationId }),
			getDonationsByType({ organization: organizationId }),
			getTopDonors(organizationId),
			getCampaignPerformance(organizationId),

			Donation.find({ organization: organizationId })
				.sort({ createdAt: -1 })
				.limit(10)
				.populate("donor", "firstName lastName email")
				.populate("campaign", "title")
				.lean(),
			// Recent campaigns
			Campaign.find({ organizations: organizationId })
				.sort({ createdAt: -1 })
				.limit(5)
				.populate("organizations", "name logo")
				.populate("causes", "title")
				.lean(),
		]);

		return res.status(200).json({
			success: true,
			data: {
				stats: {
					donations: donationStats[0] || {
						totalAmount: 0,
						totalDonations: 0,
						averageDonation: 0,
					},
					campaigns: campaignStats[0] || {
						totalCampaigns: 0,
						activeCampaigns: 0,
						completedCampaigns: 0,
						cancelledCampaigns: 0,
						totalTargetAmount: 0,
						totalRaisedAmount: 0,
						avgSupporters: 0,
						achievementRate: 0,
					},
					causes: causeStats[0] || {
						totalCauses: 0,
						totalTargetAmount: 0,
						totalRaisedAmount: 0,
						achievementRate: 0,
					},
				},
				charts: {
					monthlyTrends: monthlyDonationTrends.map((trend) => ({
						month: `${trend._id.year}-${String(trend._id.month).padStart(2, "0")}`,
						amount: trend.amount,
						count: trend.count,
					})),
					donationsByType: donationsByType.map((type) => ({
						type: type._id,
						count: type.count,
						amount: type.totalAmount,
					})),
					topDonors: topDonors.map((donor) => ({
						name: donor.donorName.trim() || "Anonymous",
						email: donor.donorEmail,
						amount: donor.totalAmount,
						count: donor.donationCount,
					})),
					campaignPerformance: campaignPerformance.map((campaign) => ({
						title: campaign.title,
						description: campaign.description,
						imageUrl: campaign.imageUrl,
						status: campaign.status,
						targetAmount: campaign.totalTargetAmount,
						raisedAmount: campaign.totalRaisedAmount,
						supporters: campaign.totalSupporters,
						achievementRate: campaign.achievementRate,
						daysRemaining: campaign.daysRemaining,
						startDate: campaign.startDate,
						endDate: campaign.endDate,
						organizations: campaign.organizations,
						causes: campaign.causes,
					})),
				},
				recentActivities: {
					donations: recentDonations.map((donation) => ({
						id: donation._id.toString(),
						type: "donation",
						amount: donation.amount,
						campaignName:
							donation.campaign &&
							typeof donation.campaign === "object" &&
							"title" in donation.campaign
								? donation.campaign.title
								: donation.description || "Direct Donation",
						timestamp: donation.createdAt,
						donorName:
							donation.donor &&
							typeof donation.donor === "object" &&
							"firstName" in donation.donor &&
							"lastName" in donation.donor
								? `${donation.donor.firstName || ""} ${donation.donor.lastName || ""}`.trim() ||
									"Anonymous"
								: "Anonymous",
						donorEmail:
							donation.donor &&
							typeof donation.donor === "object" &&
							"email" in donation.donor
								? donation.donor.email
								: "N/A",
						donationType: donation.type,
						status: donation.status,
					})),
					campaigns: recentCampaigns.map((campaign) => ({
						id: campaign._id.toString(),
						type: "campaign",
						title: campaign.title,
						description: campaign.description,
						imageUrl: campaign.imageUrl,
						status: campaign.status,
						startDate: campaign.startDate,
						endDate: campaign.endDate,
						targetAmount: campaign.totalTargetAmount,

						timestamp: campaign.createdAt,
						organizations: campaign.organizations,
						causes: campaign.causes,
					})),
				},
			},
		});
	} catch (error) {
		console.error("Error in getOrganizationDashboardStats:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to fetch dashboard data",
		});
	}
};
