import { Request, Response } from "express";
import Donation from "../models/donation.model";
import Organization from "../models/organization.model";
import { DonationStatus, DonationType } from "../models/donation.model";
import { IUser } from "../types";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";
import Feedback from "../models/feedback.model";
import mongoose from "mongoose";

interface AuthRequest extends Request {
	user?: IUser;
}

export const getDonorDashboardStats = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const donorId = req.user?._id;

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

		return res.json({
			stats: {
				totalDonations: totalDonations[0]?.total || 0,
				donationGrowth: Math.round(donationGrowth * 100) / 100,
				causesSupported: causesSupported.length,
				activeCategories: activeCategories.length,
				impactScore,
				impactPercentile,
				organizationsCount: organizationsSupported.length,
				supportingOrganizations: organizationsSupported.length,
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
		});
	} catch (error) {
		console.error("Error fetching dashboard stats:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
};

// Get organization dashboard stats
export const getOrganizationDashboardStats = async (
	req: Request,
	res: Response
) => {
	try {
		const organizationId = req.user!._id;

		// Get total donations
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

		// Get campaign stats
		const campaignStats = await Campaign.aggregate([
			{
				$match: { organizations: new mongoose.Types.ObjectId(organizationId) },
			},
			{
				$group: {
					_id: null,
					totalCampaigns: { $sum: 1 },
					activeCampaigns: {
						$sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
					},
					totalTargetAmount: { $sum: "$totalTargetAmount" },
					totalRaisedAmount: { $sum: "$totalRaisedAmount" },
				},
			},
			{
				$project: {
					_id: 0,
					totalCampaigns: 1,
					activeCampaigns: 1,
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

		// Get feedback stats
		const feedbackStats = await Feedback.aggregate([
			{ $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
			{
				$group: {
					_id: null,
					totalFeedback: { $sum: 1 },
					averageRating: { $avg: "$rating" },
					ratingDistribution: { $push: "$rating" },
				},
			},
			{
				$project: {
					_id: 0,
					totalFeedback: 1,
					averageRating: { $round: ["$averageRating", 1] },
					ratingDistribution: {
						1: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 1] },
								},
							},
						},
						2: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 2] },
								},
							},
						},
						3: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 3] },
								},
							},
						},
						4: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 4] },
								},
							},
						},
						5: {
							$size: {
								$filter: {
									input: "$ratingDistribution",
									cond: { $eq: ["$$this", 5] },
								},
							},
						},
					},
				},
			},
		]);

		// Get recent activities
		const recentActivities = await Promise.all([
			// Recent donations
			Donation.find({ organization: organizationId })
				.sort({ createdAt: -1 })
				.limit(5)
				.populate("donor", "firstName lastName"),

			// Recent campaigns
			Campaign.find({ organizations: organizationId })
				.sort({ createdAt: -1 })
				.limit(5),

			// Recent feedback
			Feedback.find({ organization: organizationId })
				.sort({ createdAt: -1 })
				.limit(5)
				.populate("donor", "firstName lastName"),
		]);

		res.status(200).json({
			success: true,
			data: {
				donations: donationStats[0] || {
					totalAmount: 0,
					totalDonations: 0,
					averageDonation: 0,
				},
				campaigns: campaignStats[0] || {
					totalCampaigns: 0,
					activeCampaigns: 0,
					totalTargetAmount: 0,
					totalRaisedAmount: 0,
					achievementRate: 0,
				},
				causes: causeStats[0] || {
					totalCauses: 0,
					totalTargetAmount: 0,
					totalRaisedAmount: 0,
					achievementRate: 0,
				},
				feedback: feedbackStats[0] || {
					totalFeedback: 0,
					averageRating: 0,
					ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
				},
				recentActivities: {
					donations: recentActivities[0],
					campaigns: recentActivities[1],
					feedback: recentActivities[2],
				},
			},
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};
