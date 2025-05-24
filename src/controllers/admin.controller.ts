import { Request, Response } from "express";
import User from "../models/user.model";
import Donation from "../models/donation.model";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";
import Feedback from "../models/feedback.model";
import Organization from "../models/organization.model";
// Get platform statistics
export const getPlatformStats = async (_req: Request, res: Response) => {
	try {
		// Get user stats
		const userStats = await User.aggregate([
			{
				$group: {
					_id: null,
					totalUsers: { $sum: 1 },
					donors: {
						$sum: { $cond: [{ $eq: ["$role", "donor"] }, 1, 0] },
					},
					organizations: {
						$sum: { $cond: [{ $eq: ["$role", "organization"] }, 1, 0] },
					},
				},
			},
			{
				$project: {
					_id: 0,
					totalUsers: 1,
					donors: 1,
					organizations: 1,
				},
			},
		]);

		// Get donation stats
		const donationStats = await Donation.aggregate([
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
			// Recent users
			User.find()
				.sort({ createdAt: -1 })
				.limit(5)
				.select("email role createdAt"),

			// Recent donations
			Donation.find()
				.sort({ createdAt: -1 })
				.limit(5)
				.populate("donor", "firstName lastName")
				.populate("organization", "name"),

			// Recent campaigns
			Campaign.find()
				.sort({ createdAt: -1 })
				.limit(5)
				.populate("organizations", "name"),

			// Recent feedback
			Feedback.find()
				.sort({ createdAt: -1 })
				.limit(5)
				.populate("donor", "firstName lastName")
				.populate("organization", "name"),
		]);

		res.status(200).json({
			success: true,
			data: {
				users: userStats[0] || {
					totalUsers: 0,
					donors: 0,
					organizations: 0,
				},
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
					users: recentActivities[0],
					donations: recentActivities[1],
					campaigns: recentActivities[2],
					feedback: recentActivities[3],
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

// Get organization verification requests
export const getVerificationRequests = async (req: Request, res: Response) => {
	try {
		const { status, page = 1, limit = 10 } = req.query;

		const query = {
			verified: false,
			...(status && { status }),
		};

		const organizations = await Organization.find(query)
			.populate("userId", "email")
			.sort({ createdAt: -1 })
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit));

		const total = await Organization.countDocuments(query);

		res.status(200).json({
			success: true,
			data: organizations,
			pagination: {
				page: Number(page),
				limit: Number(limit),
				total,
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};

// Update organization verification status
export const updateVerificationStatus = async (req: Request, res: Response) => {
	try {
		const { organizationId } = req.params;
		const { verified } = req.body;

		const organization = await Organization.findByIdAndUpdate(
			organizationId,
			{ verified },
			{ new: true }
		).populate("userId", "email");

		if (!organization) {
			return res.status(404).json({
				success: false,
				error: "Organization not found",
			});
		}

		res.status(200).json({
			success: true,
			data: organization,
		});
	} catch (error: any) {
		res.status(400).json({
			success: false,
			error: error.message,
		});
	}
};
