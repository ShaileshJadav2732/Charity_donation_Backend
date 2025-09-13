import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import { ICampaign } from "../types/campaign";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import Organization, { IOrganization } from "../models/organization.model";
import { AuthRequest } from "../types";
import { AppError } from "../utils/appError";
import { catchAsync } from "../utils/catchAsync";
import {
	OrganizationResponse,
	DonorResponse,
	CampaignResponse,
} from "../types/organization";
import { DonationStatus, DonationType } from "../types";
const formatOrganizationResponse = (
	organization: IOrganization & { _id: mongoose.Types.ObjectId }
): OrganizationResponse => ({
	id: organization._id.toString(),
	userId: organization.userId.toString(),
	name: organization.name,
	description: organization.description,
	phoneNumber: organization.phoneNumber,
	email: organization.email,
	website: organization.website || null,
	address: organization.address || null,
	city: organization.city || null,
	state: organization.state || null,
	country: organization.country || null,
	logo: organization.logo || null,
	verified: organization.verified,
	createdAt: organization.createdAt.toISOString(),
	updatedAt: organization.updatedAt.toISOString(),
});

/**
 * Get current organization profile for authenticated user
 */
export const getCurrentOrganization = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const organization = await Organization.findOne({ userId: req.user.id });
		if (!organization) {
			throw new AppError("Organization profile not found", 404);
		}

		res.status(200).json({
			message: "Organization Profile",
			organization: formatOrganizationResponse(organization),
		});
	}
);

/**
 * Get all organizations with pagination and search
 */
export const getOrganizations = catchAsync(
	async (req: Request, res: Response) => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;

		const query: mongoose.FilterQuery<IOrganization> = {};
		if (search) {
			query.$text = { $search: search };
		}

		const [organizations, total] = await Promise.all([
			Organization.find(query)
				.sort({ createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit),
			Organization.countDocuments(query),
		]);

		res.status(200).json({
			organizations: organizations.map(formatOrganizationResponse),
			total,
			page,
			limit,
		});
	}
);

/**
 * Get single organization by ID
 */
export const getOrganizationById = catchAsync(
	async (req: Request, res: Response) => {
		const { id } = req.params;

		if (!mongoose.Types.ObjectId.isValid(id)) {
			throw new AppError("Invalid organization ID format", 400);
		}

		const organization = await Organization.findById(id);
		if (!organization) {
			throw new AppError("Organization not found", 404);
		}

		res.status(200).json({
			organization: formatOrganizationResponse(organization),
		});
	}
);

/**
 * Get organization by cause ID
 */
export const getOrganizationByCauseId = catchAsync(
	async (req: Request, res: Response) => {
		const { causeId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(causeId)) {
			throw new AppError("Invalid cause ID format", 400);
		}

		const cause = await Cause.findById(causeId);
		if (!cause) {
			throw new AppError("Cause not found", 404);
		}

		const organization = await Organization.findById(cause.organizationId);
		if (!organization) {
			throw new AppError("Organization not found for this cause", 404);
		}

		res.status(200).json({
			organization: formatOrganizationResponse(organization),
		});
	}
);

/**
 * Get donors for an organization with detailed analytics
 */
export const getOrganizationDonors = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const { page = 1, limit = 10, search } = req.query;
		const numericPage = parseInt(page as string);
		const numericLimit = parseInt(limit as string);

		// Find organization
		const organization = await Organization.findOne({ userId: req.user.id });
		if (!organization) {
			throw new AppError("Organization profile not found", 404);
		}

		// Build aggregation pipeline
		const pipeline: mongoose.PipelineStage[] = [
			{
				$match: {
					organization: organization._id,
					status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
				},
			},
			{
				$group: {
					_id: "$donor",
					totalDonated: {
						$sum: {
							$cond: [{ $eq: ["$type", DonationType.MONEY] }, "$amount", 0],
						},
					},
					totalDonations: { $sum: 1 },
					lastDonation: { $max: "$createdAt" },
					firstDonation: { $min: "$createdAt" },
					donationTypes: { $addToSet: "$type" },
					causes: { $addToSet: "$cause" },
				},
			},
			{
				$lookup: {
					from: "users",
					localField: "_id",
					foreignField: "_id",
					as: "userInfo",
				},
			},
			{ $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
			{
				$lookup: {
					from: "donorprofiles",
					localField: "_id",
					foreignField: "userId",
					as: "donorProfile",
				},
			},
			{ $unwind: { path: "$donorProfile", preserveNullAndEmptyArrays: true } },
			{
				$addFields: {
					donorName: {
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
							else: "$userInfo.email",
						},
					},
					email: "$userInfo.email",
					phoneNumber: "$donorProfile.phoneNumber",
					address: "$donorProfile.address",
					city: "$donorProfile.city",
					state: "$donorProfile.state",
					country: "$donorProfile.country",
					profileImage: "$donorProfile.profileImage",
					frequency: {
						$cond: {
							if: { $gte: ["$totalDonations", 12] },
							then: "Regular",
							else: {
								$cond: {
									if: { $gte: ["$totalDonations", 5] },
									then: "Frequent",
									else: "Occasional",
								},
							},
						},
					},
					impactScore: {
						$min: [
							100,
							{
								$add: [
									{ $multiply: [{ $divide: ["$totalDonated", 100] }, 0.7] },
									{ $multiply: ["$totalDonations", 2] },
								],
							},
						],
					},
				},
			},
		];

		// Execute aggregation
		const donorsAggregation = await Donation.aggregate(pipeline);

		// Apply search filter if provided
		let filteredDonors = donorsAggregation;
		if (search) {
			const searchRegex = new RegExp(search as string, "i");
			filteredDonors = donorsAggregation.filter(
				(donor) =>
					searchRegex.test(donor.donorName) || searchRegex.test(donor.email)
			);
		}

		// Paginate results
		const total = filteredDonors.length;
		const paginatedDonors = filteredDonors.slice(
			(numericPage - 1) * numericLimit,
			numericPage * numericLimit
		);

		// Format response
		const formattedDonors: DonorResponse[] = paginatedDonors.map((donor) => ({
			id: donor._id.toString(),
			name: donor.donorName,
			email: donor.email,
			phoneNumber: donor.phoneNumber || null,
			address: {
				street: donor.address || null,
				city: donor.city || null,
				state: donor.state || null,
				country: donor.country || null,
			},
			profileImage: donor.profileImage || null,
			totalDonated: Math.round(donor.totalDonated * 100) / 100,
			totalDonations: donor.totalDonations,
			lastDonation: donor.lastDonation,
			firstDonation: donor.firstDonation,
			frequency: donor.frequency,
			impactScore: Math.round(donor.impactScore),
			donationTypes: donor.donationTypes,
			causesSupported: donor.causes.length,
		}));

		// Calculate summary stats
		const totalDonors = total;
		const totalFundsRaised = donorsAggregation.reduce(
			(sum, donor) => sum + donor.totalDonated,
			0
		);
		const totalDonations = donorsAggregation.reduce(
			(sum, donor) => sum + donor.totalDonations,
			0
		);
		const averageDonation =
			totalDonations > 0 ? totalFundsRaised / totalDonations : 0;

		res.status(200).json({
			success: true,
			data: {
				donors: formattedDonors,
				pagination: {
					page: numericPage,
					limit: numericLimit,
					total,
					totalPages: Math.ceil(total / numericLimit),
				},
				summary: {
					totalDonors,
					totalFundsRaised: Math.round(totalFundsRaised * 100) / 100,
					averageDonation: Math.round(averageDonation * 100) / 100,
				},
			},
		});
	}
);

/**
 * Helper function to calculate campaign totals from donations
 */
const calculateCampaignTotals = async (campaignId: string) => {
	const result = await Donation.aggregate([
		{
			$match: {
				campaign: new mongoose.Types.ObjectId(campaignId),
				status: { $ne: "CANCELLED" },
			},
		},
		{
			$group: {
				_id: null,
				totalRaisedAmount: { $sum: "$amount" },
				totalSupporters: { $addToSet: "$donor" },
			},
		},
		{
			$project: {
				totalRaisedAmount: 1,
				totalSupporters: { $size: "$totalSupporters" },
			},
		},
	]);

	return {
		totalRaisedAmount: result[0]?.totalRaisedAmount || 0,
		totalSupporters: result[0]?.totalSupporters || 0,
	};
};

/**
 * Helper function to format campaign response with calculated totals
 */
const formatCampaignResponse = async (
	campaign: ICampaign & { _id: mongoose.Types.ObjectId }
): Promise<CampaignResponse> => {
	const { totalRaisedAmount, totalSupporters } = await calculateCampaignTotals(
		campaign._id.toString()
	);

	return {
		id: campaign._id.toString(),
		title: campaign.title,
		description: campaign.description,
		startDate: campaign.startDate.toISOString(),
		endDate: campaign.endDate.toISOString(),
		status: campaign.status,
		totalTargetAmount: campaign.totalTargetAmount,
		totalRaisedAmount,
		totalSupporters,
		imageUrl: campaign.imageUrl,
		tags: campaign.tags || [],
		acceptedDonationTypes: campaign.acceptedDonationTypes,
		organizations: campaign.organizations.map((org) => org.toString()),
		causes: campaign.causes.map((cause) => cause.toString()),
		createdAt: campaign.createdAt.toISOString(),
		updatedAt: campaign.updatedAt.toISOString(),
	};
};

/**
 * Get campaigns for an organization
 */
export const getOrganizationCampaigns = catchAsync(
	async (req: Request, res: Response) => {
		const { organizationId } = req.params;
		const { page = 1, limit = 10, search, status } = req.query;
		const numericPage = parseInt(page as string);
		const numericLimit = parseInt(limit as string);

		if (!mongoose.Types.ObjectId.isValid(organizationId)) {
			throw new AppError("Invalid organization ID", 400);
		}

		const query: mongoose.FilterQuery<ICampaign> = {
			organizations: new mongoose.Types.ObjectId(organizationId),
		};

		if (search) {
			query.$text = { $search: search as string };
		}

		if (status && status !== "all") {
			query.status = status as string;
		}

		const [campaigns, total] = await Promise.all([
			Campaign.find(query)
				.sort({ createdAt: -1 })
				.skip((numericPage - 1) * numericLimit)
				.limit(numericLimit)
				.populate("organizations", "name email phone")
				.populate("causes", "title description targetAmount"),
			Campaign.countDocuments(query),
		]);

		const formattedCampaigns = await Promise.all(
			campaigns.map((campaign) => formatCampaignResponse(campaign))
		);

		res.status(200).json({
			success: true,
			data: formattedCampaigns,
			pagination: {
				total,
				page: numericPage,
				pages: Math.ceil(total / numericLimit),
			},
		});
	}
);
