import { Request, Response } from "express";
import Donation from "../models/donation.model";
import Organization from "../models/organization.model";
import { DonationStatus, DonationType } from "../models/donation.model";
import { IUser } from "../types";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";

import mongoose from "mongoose";

// Override the Request type's user property with our IUser type
interface AuthRequest extends Omit<Request, "user"> {
	user?: IUser;
}

export const getDonorDashboardStats = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const authReq = req as AuthRequest;
		const donorId = authReq.user?._id;

		if (!donorId) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		// Get total donations amount
		const totalDonations = await Donation.aggregate([
			{
				$match: {
					donor: donorId,
					type: DonationType.MONEY,
					status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
				},
			},
			{
				$group: {
					_id: null,
					total: { $sum: "$amount" },
				},
			},
		]);

		// Get donation growth (comparing last month with previous month)
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
				{
					$group: {
						_id: null,
						total: { $sum: "$amount" },
					},
				},
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
				{
					$group: {
						_id: null,
						total: { $sum: "$amount" },
					},
				},
			]),
		]);

		// Calculate donation growth percentage
		const lastMonthTotal = lastMonthDonations[0]?.total || 0;
		const previousMonthTotal = previousMonthDonations[0]?.total || 0;
		const donationGrowth =
			previousMonthTotal === 0
				? 100
				: ((lastMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;

		// Get unique causes (donation types) supported
		const causesSupported = await Donation.distinct("type", {
			donor: donorId,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		});

		// Get active categories (donation types with recent activity)
		const activeCategories = await Donation.distinct("type", {
			donor: donorId,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
			createdAt: { $gte: lastMonth },
		});

		// Get unique organizations supported
		const organizationsSupported = await Donation.distinct("organization", {
			donor: donorId,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		});

		// Get recent activity
		const recentActivity = await Donation.find({
			donor: donorId,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		})
			.sort({ createdAt: -1 })
			.limit(5)
			.populate("organization", "name")
			.lean();

		// Calculate impact score (based on total donations and frequency)
		const allDonations = await Donation.countDocuments({
			donor: donorId,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		});

		// Simple impact score calculation (can be made more sophisticated)
		const impactScore = Math.min(
			100,
			Math.floor(
				((totalDonations[0]?.total || 0) / 1000) * 10 + allDonations * 5
			)
		);

		// Calculate impact percentile (simplified version)
		const allDonors = await Donation.distinct("donor");
		const impactPercentile = Math.floor(
			((allDonors.length - 1) / allDonors.length) * 100
		);

		// Get monthly donation trends (last 6 months)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const monthlyTrends = await Donation.aggregate([
			{
				$match: {
					donor: donorId,
					type: DonationType.MONEY,
					status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
					createdAt: { $gte: sixMonthsAgo },
				},
			},
			{
				$group: {
					_id: {
						year: { $year: "$createdAt" },
						month: { $month: "$createdAt" },
					},
					amount: { $sum: "$amount" },
					count: { $sum: 1 },
				},
			},
			{
				$sort: { "_id.year": 1, "_id.month": 1 },
			},
		]);

		// Get donation distribution by type
		const donationsByType = await Donation.aggregate([
			{
				$match: {
					donor: donorId,
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

		// Get top causes by donation amount
		const topCauses = await Donation.aggregate([
			{
				$match: {
					donor: donorId,
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
			{
				$unwind: "$causeInfo",
			},
			{
				$group: {
					_id: "$cause",
					causeName: { $first: "$causeInfo.title" },
					totalAmount: { $sum: "$amount" },
					donationCount: { $sum: 1 },
				},
			},
			{
				$sort: { totalAmount: -1 },
			},
			{
				$limit: 5,
			},
		]);

		return res.json({
			success: true,
			data: {
				stats: {
					totalDonations: totalDonations[0]?.total || 0,
					donationGrowth: Math.round(donationGrowth * 100) / 100,
					causesSupported: causesSupported.length,
					activeCategories: activeCategories.length,
					impactScore,
					impactPercentile,
					organizationsCount: organizationsSupported.length,
					supportingOrganizations: organizationsSupported.length,
					totalDonationCount: allDonations,
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
					id: activity._id,
					type: "donation",
					amount: activity.amount,
					campaignName: activity.description,
					timestamp: activity.createdAt,
					organizationId: activity.organization._id,
					organizationName: (activity.organization as any).name,
				})),
			},
		});
	} catch (error) {
		return res.status(500).json({ message: "Internal server error" });
	}
};

export const getOrganizationDashboardStats = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const authReq = req as AuthRequest;
		const userId = authReq.user?._id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				error: "Unauthorized",
			});
		}

		// Get organization ID from the authenticated user
		const organization = await Organization.findOne({ userId });
		if (!organization) {
			return res.status(404).json({
				success: false,
				error: "Organization not found",
			});
		}

		const organizationId = organization._id;

		// Get donation stats
		const donationStats = await Donation.aggregate([
			{ $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
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
		]);

		// Get campaign stats with accurate calculations
		const campaignStats = await Campaign.aggregate([
			{
				$match: {
					organizations: new mongoose.Types.ObjectId(organizationId),
					status: { $ne: "draft" }, // Exclude draft campaigns from stats
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
											{ $divide: ["$totalRaisedAmount", "$totalTargetAmount"] },
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
		]);

		// Get cause stats
		const causeStats = await Cause.aggregate([
			{
				$match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
			},
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
		]);

		// Get recent activities
		const recentDonations = await Donation.find({
			organization: organizationId,
		})
			.sort({ createdAt: -1 })
			.limit(10)
			.populate("donor", "firstName lastName email")
			.populate("campaign", "title")
			.lean();

		// Get recent campaigns with proper population
		const recentCampaigns = await Campaign.find({
			organizations: organizationId,
		})
			.sort({ createdAt: -1 })
			.limit(5)
			.populate("organizations", "name logo")
			.populate("causes", "title")
			.lean();

		// Get monthly donation trends for organization
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const monthlyDonationTrends = await Donation.aggregate([
			{
				$match: {
					organization: new mongoose.Types.ObjectId(organizationId),
					type: DonationType.MONEY,
					status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
					createdAt: { $gte: sixMonthsAgo },
				},
			},
			{
				$group: {
					_id: {
						year: { $year: "$createdAt" },
						month: { $month: "$createdAt" },
					},
					amount: { $sum: "$amount" },
					count: { $sum: 1 },
				},
			},
			{
				$sort: { "_id.year": 1, "_id.month": 1 },
			},
		]);

		// Get donation distribution by type
		const donationsByType = await Donation.aggregate([
			{
				$match: {
					organization: new mongoose.Types.ObjectId(organizationId),
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

		// Get top donors
		const topDonors = await Donation.aggregate([
			{
				$match: {
					organization: new mongoose.Types.ObjectId(organizationId),
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
			{
				$unwind: "$donorInfo",
			},
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
			{
				$sort: { totalAmount: -1 },
			},
			{
				$limit: 5,
			},
		]);

		// Get campaign performance with accurate calculations
		const campaignPerformance = await Campaign.aggregate([
			{
				$match: {
					organizations: new mongoose.Types.ObjectId(organizationId),
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
							in: {
								name: "$$org.name",
								id: "$$org._id",
								logo: "$$org.logo",
							},
						},
					},
					causes: {
						$map: {
							input: "$causes",
							as: "cause",
							in: {
								title: "$$cause.title",
								id: "$$cause._id",
							},
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
			{
				$sort: { achievementRate: -1 },
			},
			{
				$limit: 5,
			},
		]);

		res.status(200).json({
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
					donations: recentDonations.map((donation: any) => ({
						id: donation._id,
						type: "donation",
						amount: donation.amount,
						campaignName:
							donation.campaign?.title ||
							donation.description ||
							"Direct Donation",
						timestamp: donation.createdAt,
						donorName: donation.donor
							? `${donation.donor.firstName || ""} ${donation.donor.lastName || ""}`.trim() ||
								"Anonymous"
							: "Anonymous",
						donorEmail: donation.donor?.email || "N/A",
						donationType: donation.type,
						status: donation.status,
					})),
					campaigns: recentCampaigns.map((campaign: any) => ({
						id: campaign._id,
						type: "campaign",
						title: campaign.title,
						description: campaign.description,
						imageUrl: campaign.imageUrl,
						status: campaign.status,
						startDate: campaign.startDate,
						endDate: campaign.endDate,
						targetAmount: campaign.totalTargetAmount,
						raisedAmount: campaign.totalRaisedAmount,
						supporters: campaign.totalSupporters,
						timestamp: campaign.createdAt,
						organizations: campaign.organizations,
						causes: campaign.causes,
					})),
				},
			},
		});
	} catch (error: any) {
		console.error("Dashboard error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch dashboard data",
			details:
				process.env.NODE_ENV === "development" ? error.message : undefined,
		});
	}
};
