import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign, { ICampaign } from "../models/campaign.model";
import Cause from "../models/cause.model";
import OrganizationProfile from "../models/organization.model";
import Donation, { DonationType } from "../models/donation.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { validateObjectId } from "../utils/validation";

interface AuthRequest extends Request {
	user?: IUser;
}

// Helper function to format campaign response
const formatCampaignResponse = (
	campaign: ICampaign & { _id: mongoose.Types.ObjectId }
) => ({
	_id: campaign._id.toString(),
	title: campaign.title,
	description: campaign.description,
	startDate: campaign.startDate.toISOString(),
	endDate: campaign.endDate.toISOString(),
	status: campaign.status,
	causes: campaign.causes, // Populated by Mongoose
	organizations: campaign.organizations, // Changed from organizationId
	totalTargetAmount: campaign.totalTargetAmount,
	totalRaisedAmount: campaign.totalRaisedAmount,
	totalSupporters: campaign.totalSupporters,
	imageUrl: campaign.imageUrl,
	acceptedDonationTypes: campaign.acceptedDonationTypes,
	createdAt: campaign.createdAt.toISOString(),
	updatedAt: campaign.updatedAt.toISOString(),
});

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

	// Log query parameters for debugging
	console.log("Campaign query parameters:", {
		organization,
		organizations,
		status,
		cause,
		search
	});

	// Handle text search
	if (search) {
		query.$text = { $search: search as string };
	}

	// Handle status filter
	if (status && status !== 'all') {
		query.status = status;
	}

	// Handle organization filter - check for specific organization
	if (organization) {
		if (!validateObjectId(organization as string)) {
			throw new AppError("Invalid organization ID", 400);
		}
		query.organizations = organization;
	}

	// Handle organizations filter - used from frontend
	if (organizations) {
		if (!validateObjectId(organizations as string)) {
			throw new AppError("Invalid organizations parameter", 400);
		}
		// Use $in to match any ID in the organizations array
		query.organizations = { $in: [organizations] };
	}

	// Handle cause filter
	if (cause) {
		if (!validateObjectId(cause as string)) {
			throw new AppError("Invalid cause ID", 400);
		}
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

	// Log the final query for debugging
	console.log("Final campaign query:", query);

	const sort: any = {};
	sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

	const skip = (Number(page) - 1) * Number(limit);

	const [campaigns, total] = await Promise.all([
		Campaign.find(query)
			.populate("organizations", "name email phone")
			.populate("causes", "title description targetAmount raisedAmount")
			.sort(sort)
			.skip(skip)
			.limit(Number(limit)),
		Campaign.countDocuments(query),
	]);

	// Log the found campaigns
	console.log(`Found ${campaigns.length} campaigns`);

	res.status(200).json({
		success: true,
		data: campaigns.map(formatCampaignResponse),
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

		if (!validateObjectId(campaignId)) {
			throw new AppError("Invalid campaign ID", 400);
		}

		const campaign = await Campaign.findById(campaignId)
			.populate("organizationId", "name email phone address")
			.populate("causes", "title description targetAmount raisedAmount");

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign),
		});
	}
);

// Get campaign details with donation statistics
export const getCampaignDetails = catchAsync(
	async (req: Request, res: Response) => {
		try {
			const { campaignId } = req.params;

			if (!validateObjectId(campaignId)) {
				throw new AppError("Invalid campaign ID format", 400);
			}

			const campaign = await Campaign.findById(campaignId)
				.populate("organizations", "name email phone address")
				.populate("causes", "title description targetAmount raisedAmount");

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

			res.status(200).json({
				success: true,
				data: {
					campaign: formatCampaignResponse(campaign),
					donationStats,
				},
			});
		} catch (err) {
			console.error("Error getting campaign details:", err);
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

		// Check if organizations field exists and includes the user's organization
		// const userIdForCreate = req.user!._id;
		// if (!organizations || !organizations.includes(userIdForCreate)) {
		// 	throw new AppError("You must include your own organization ID", 403);
		// }

		if (totalTargetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
		}

		const validCauses = await Cause.find({
			_id: { $in: causes },
			organizationId: req.user._id,
		});

		if (validCauses.length !== causes.length) {
			throw new AppError("Invalid or unauthorized cause IDs", 400);
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
			totalRaisedAmount: 0,
			totalSupporters: 0,
		});

		await campaign.populate({
			path: "causes",
			select: "title description targetAmount raisedAmount",
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		res.status(201).json({
			success: true,
			data: formatCampaignResponse(campaign),
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

		if (!validateObjectId(campaignId)) {
			throw new AppError("Invalid campaign ID", 400);
		}

		const campaign = await Campaign.findById(campaignId);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		const userIdForUpdate = req.user!._id;
		if (
			!campaign.organizations.some(
				(orgId) => orgId.toString() === userIdForUpdate
			)
		) {
			throw new AppError(
				"Unauthorized: You do not have permission to update this campaign",
				403
			);
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

		if (totalTargetAmount !== undefined && totalTargetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
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
				(type: string) => !validDonationTypes.includes(type)
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
			if (validCauses.length !== causes.length) {
				throw new AppError("Invalid or unauthorized cause IDs", 400);
			}
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
			select: "title description targetAmount raisedAmount",
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign),
		});
	}
);

// Update campaign status
export const updateCampaignStatus = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can update campaign status",
				403
			);
		}

		const { campaignId } = req.params;
		const { status } = req.body;

		if (!validateObjectId(campaignId)) {
			throw new AppError("Invalid campaign ID", 400);
		}

		const campaign = await Campaign.findById(campaignId);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		const userIdForStatus = req.user!._id;
		if (
			!campaign.organizations.some(
				(orgId) => orgId.toString() === userIdForStatus
			)
		) {
			throw new AppError(
				"Unauthorized: You do not have permission to update this campaign",
				403
			);
		}

		const validStatuses = ["draft", "active", "completed", "cancelled"];
		if (!validStatuses.includes(status)) {
			throw new AppError("Invalid status", 400);
		}

		campaign.status = status;
		await campaign.save();

		await campaign.populate({
			path: "causes",
			select: "title description targetAmount raisedAmount",
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign),
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
			console.log(`Attempting to delete campaign with ID: ${campaignId}`);

			// Validate ID format
			if (!validateObjectId(campaignId)) {
				throw new AppError("Invalid campaign ID format", 400);
			}

			// Find the campaign
			const campaign = await Campaign.findById(campaignId);
			if (!campaign) {
				console.log(`Campaign not found with ID: ${campaignId}`);
				throw new AppError("Campaign not found", 404);
			}

			// Check if user has permission to delete
			const userIdForDelete = req.user!._id.toString();
			console.log(`User ID: ${userIdForDelete}, Campaign Orgs: ${campaign.organizations}`);

			const hasPermission = campaign.organizations.some(
				(orgId) => orgId.toString() === userIdForDelete
			);

			if (!hasPermission) {
				console.log(`User ${userIdForDelete} not authorized to delete campaign ${campaignId}`);
				throw new AppError(
					"Unauthorized: You do not have permission to delete this campaign",
					403
				);
			}

			// Check if the campaign has donations
			// If it does, prevent deletion or mark as cancelled instead
			const donations = await Donation.countDocuments({ campaign: campaignId });
			if (donations > 0) {
				console.log(`Campaign ${campaignId} has ${donations} donations - marking as cancelled instead of deleting`);
				campaign.status = "cancelled";
				await campaign.save();
				return res.status(200).json({
					success: true,
					message: "Campaign has existing donations and cannot be deleted. It has been marked as cancelled instead."
				});
			}

			// Delete the campaign
			const result = await campaign.deleteOne();
			console.log(`Successfully deleted campaign with ID: ${campaignId}`, result);

			// Return success response with detailed message
			return res.status(200).json({
				success: true,
				message: "Campaign successfully deleted",
				data: { id: campaignId }
			});
		} catch (error) {
			// This catch block will be handled by the catchAsync wrapper
			console.error(`Error deleting campaign:`, error);
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

		if (!validateObjectId(campaignId) || !validateObjectId(causeId)) {
			throw new AppError("Invalid campaign or cause ID", 400);
		}

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
			select: "title description targetAmount raisedAmount",
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign),
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

		if (!validateObjectId(campaignId) || !validateObjectId(causeId)) {
			throw new AppError("Invalid campaign or cause ID", 400);
		}

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
			select: "title description targetAmount raisedAmount",
		});
		await campaign.populate({
			path: "organizations",
			select: "name email phone",
		});

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign),
		});
	}
);
