// backend/controllers/campaign.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import Cause from "../models/cause.model";
import OrganizationProfile from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { DonationType } from "../models/donation.model";

interface AuthRequest extends Request {
	user?: IUser;
}

// Helper function to format campaign response for frontend
const formatCampaignResponse = (campaign: any) => ({
	id: campaign._id.toString(),
	title: campaign.title,
	description: campaign.description,
	startDate: campaign.startDate.toISOString(),
	endDate: campaign.endDate.toISOString(),
	status: campaign.status,
	causes: campaign.causes, // Populated by Mongoose
	organizations: campaign.organizations, // Populated by Mongoose
	totalTargetAmount: campaign.totalTargetAmount,
	totalRaisedAmount: campaign.totalRaisedAmount,
	totalSupporters: campaign.totalSupporters,
	imageUrl: campaign.imageUrl,
	tags: campaign.tags,
	acceptedDonationTypes: campaign.acceptedDonationTypes,
	createdAt: campaign.createdAt.toISOString(),
	updatedAt: campaign.updatedAt.toISOString(),
});

// Get all campaigns with pagination and filters
export const getCampaigns = catchAsync(async (req: Request, res: Response) => {
	const page = parseInt(req.query.page as string) || 1;
	const limit = parseInt(req.query.limit as string) || 10;
	const search = req.query.search as string;
	const status = req.query.status as string;
	const tag = req.query.tag as string;

	const query: any = {};

	if (status && status !== "all") {
		query.status = status;
	}

	if (search) {
		query.$text = { $search: search };
	}

	if (tag) {
		query.tags = tag;
	}

	const skip = (page - 1) * limit;

	const [campaigns, total] = await Promise.all([
		Campaign.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.populate("causes", "title targetAmount raisedAmount")
			.populate("organizations", "name"),
		Campaign.countDocuments(query),
	]);

	res.status(200).json({
		campaigns: campaigns.map(formatCampaignResponse),
		total,
		page,
		limit,
	});
});

// Get a single campaign by ID
export const getCampaignById = catchAsync(
	async (req: Request, res: Response) => {
		const campaign = await Campaign.findById(req.params.id)
			.populate("causes", "title targetAmount raisedAmount")
			.populate("organizations", "name");

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		res.status(200).json({
			campaign: formatCampaignResponse(campaign),
		});
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
		} = req.body;

		// Validate required fields
		if (
			!title ||
			!description ||
			!causes?.length ||
			!acceptedDonationTypes?.length ||
			!startDate ||
			!endDate
		) {
			throw new AppError("Missing required fields", 400);
		}

		// Validate causes exist and belong to the organization
		const validCauses = await Cause.find({
			_id: { $in: causes },
			organizationId: req.user._id,
		});

		if (validCauses.length !== causes.length) {
			throw new AppError("Invalid or unauthorized cause IDs", 400);
		}

		// Validate dates
		const start = new Date(startDate);
		const end = new Date(endDate);
		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			throw new AppError("Invalid date format", 400);
		}
		if (start >= end) {
			throw new AppError("End date must be after start date", 400);
		}

		const campaign = await Campaign.create({
			title,
			description,
			causes,
			acceptedDonationTypes,
			startDate: start,
			endDate: end,
			organizationId: req.user._id,
		});

		await campaign.populate({
			path: "causes",
			populate: { path: "organizationId", select: "name" },
		});

		res.status(201).json({
			campaign: {
				id: campaign._id.toString(),
				title: campaign.title,
				description: campaign.description,
				causes: campaign.causes.map((cause: any) => ({
					id: cause._id.toString(),
					title: cause.title,
					organizationName: cause.organizationId?.name,
				})),
				acceptedDonationTypes: campaign.acceptedDonationTypes,
				startDate: campaign.startDate.toISOString(),
				endDate: campaign.endDate.toISOString(),
				organizationId: campaign.organizations[0]?.toString(),
				createdAt: campaign.createdAt.toISOString(),
				updatedAt: campaign.updatedAt.toISOString(),
			},
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

		const campaign = await Campaign.findById(req.params.id);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		// Check if user’s organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
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
			tags,
			acceptedDonationTypes,
			status,
		} = req.body;

		// Validate dates if provided
		if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
			throw new AppError("End date must be after start date", 400);
		}

		// Validate totalTargetAmount if provided
		if (totalTargetAmount !== undefined && totalTargetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
		}

		// Validate acceptedDonationTypes if provided
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

		// Validate status if provided
		if (
			status &&
			!["draft", "active", "completed", "cancelled"].includes(status)
		) {
			throw new AppError("Invalid status", 400);
		}

		// Update fields
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
			tags: tags || campaign.tags,
			acceptedDonationTypes:
				acceptedDonationTypes || campaign.acceptedDonationTypes,
			status: status || campaign.status,
		});

		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			campaign: formatCampaignResponse(campaign),
		});
	}
);

// Delete a campaign
export const deleteCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can delete campaigns",
				403
			);
		}

		const campaign = await Campaign.findById(req.params.id);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		// Check if user’s organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to delete this campaign",
				403
			);
		}

		await campaign.deleteOne();

		res.status(204).json({});
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

		const { causeId } = req.body;

		if (!causeId) {
			throw new AppError("Cause ID is required", 400);
		}

		const campaign = await Campaign.findById(req.params.id);
		const cause = await Cause.findById(causeId);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		if (!cause) {
			throw new AppError("Cause not found", 404);
		}

		// Check if user’s organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		// Check if cause belongs to one of the campaign’s organizations
		if (!cause.organizationId.equals(req.user._id)) {
			throw new AppError("Cause does not belong to your organization", 403);
		}

		if (campaign.causes.includes(causeId)) {
			throw new AppError("Cause already added to campaign", 400);
		}

		campaign.causes.push(causeId);
		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			campaign: formatCampaignResponse(campaign),
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

		const campaign = await Campaign.findById(req.params.id);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		// Check if user’s organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		const causeId = req.params.causeId;

		if (!campaign.causes.includes(causeId as any)) {
			throw new AppError("Cause not found in campaign", 400);
		}

		campaign.causes = campaign.causes.filter((id) => id.toString() !== causeId);
		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			campaign: formatCampaignResponse(campaign),
		});
	}
);

// Add an organization to a campaign
export const addOrganizationToCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can modify campaigns",
				403
			);
		}

		const { organizationId } = req.body;

		if (!organizationId) {
			throw new AppError("Organization ID is required", 400);
		}

		const campaign = await Campaign.findById(req.params.id);
		const organization = await OrganizationProfile.findOne({
			userId: organizationId,
		});

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		if (!organization) {
			throw new AppError("Organization not found", 404);
		}

		// Check if user’s organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		if (campaign.organizations.includes(organizationId as any)) {
			throw new AppError("Organization already added to campaign", 400);
		}

		campaign.organizations.push(organizationId);
		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			campaign: formatCampaignResponse(campaign),
		});
	}
);

// Remove an organization from a campaign
export const removeOrganizationFromCampaign = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user || req.user.role !== "organization") {
			throw new AppError(
				"Unauthorized: Only organizations can modify campaigns",
				403
			);
		}

		const campaign = await Campaign.findById(req.params.id);

		if (!campaign) {
			throw new AppError("Campaign not found", 404);
		}

		// Check if user’s organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		const organizationId = req.params.organizationId;

		if (!campaign.organizations.includes(organizationId as any)) {
			throw new AppError("Organization not found in campaign", 400);
		}

		// Prevent removing the last organization
		if (campaign.organizations.length === 1) {
			throw new AppError("Campaign must have at least one organization", 400);
		}

		campaign.organizations = campaign.organizations.filter(
			(id) => id.toString() !== organizationId
		);
		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			campaign: formatCampaignResponse(campaign),
		});
	}
);
