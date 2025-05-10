import { Request, Response } from "express";
import Donation from "../models/donation.model";
import Organization from "../models/organization.model";
import { DonationStatus, DonationType } from "../models/donation.model";
import { IUser } from "../types";

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
