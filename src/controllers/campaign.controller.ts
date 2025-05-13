// backend/controllers/campaign.controller.ts
import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Campaign, { ICampaign } from "../models/campaign.model";
import Cause from "../models/cause.model";
import OrganizationProfile from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { DonationType } from "../models/donation.model";
import { validateObjectId } from "../utils/validation";
import Donation from "../models/donation.model";

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
export const createCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user || req.user.role !== "organization") {
		throw new AppError("Unauthorized: Only organizations can create campaigns", 403);
	}

	const {
		title,
		description,
		causes,
		acceptedDonationTypes,
		startDate,
		endDate,
		imageUrl,
		tags,
		status,
		targetAmount,
		targetQuantity,
		donationType,
		location,
		requirements,
		impact,
	} = req.body;

	// Validate required fields
	if (!title || !description || !causes?.length || !acceptedDonationTypes?.length || !startDate || !endDate || !imageUrl || !status) {
		throw new AppError("Missing required fields", 400);
	}

	// Convert cause IDs to ObjectIds
	const causeIds = causes.map((id: string) => new Types.ObjectId(id));

	// Validate causes exist and belong to the organization
	const validCauses = await Cause.find({
		_id: { $in: causeIds },
		organizationId: new Types.ObjectId(req.user._id)
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

	// Validate donation types
	const validDonationTypes = Object.values(DonationType);
	const invalidTypes = acceptedDonationTypes.filter((type: string) => !validDonationTypes.includes(type as DonationType));
	if (invalidTypes.length > 0) {
		throw new AppError(`Invalid donation types: ${invalidTypes.join(", ")}`, 400);
	}

	// Calculate total target amount from causes
	const totalTargetAmount = validCauses.reduce((sum, cause) => sum + cause.targetAmount, 0);

	// Create campaign
	const campaign = await Campaign.create({
		title,
		description,
		causes: causeIds,
		organizations: [new Types.ObjectId(req.user._id)], // Add creating organization
		acceptedDonationTypes: acceptedDonationTypes as DonationType[],
		startDate: start,
		endDate: end,
		imageUrl,
		tags: tags || [],
		totalTargetAmount,
		totalRaisedAmount: 0,
		totalSupporters: 0,
		status: status,
	});

	res.status(201).json({
		success: true,
		data: {
			campaign: campaign,
		},
		message: "Campaign created successfully"
	});
});

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

		// Check if user's organization is associated with the campaign
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

		// Check if user's organization is associated with the campaign
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

		// Check if user's organization is associated with the campaign
		if (!campaign.organizations.includes(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		// Check if cause belongs to one of the campaign's organizations
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

		// Check if user's organization is associated with the campaign
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

		// Check if user's organization is associated with the campaign
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

		// Check if user's organization is associated with the campaign
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

// Get campaigns with search and filtering
export const getCampaigns = async (req: Request, res: Response) => {
	try {
		const {
			search,
			status,
			organization,
			cause,
			tag,
			startDate,
			endDate,
			page = 1,
			limit = 10,
			sortBy = "createdAt",
			sortOrder = "desc",
		} = req.query;

		const query: any = {};

		// Search in title and description
		if (search) {
			query.$text = { $search: search as string };
		}

		// Filter by status
		if (status) {
			query.status = status;
		}

		// Filter by organization
		if (organization) {
			if (!validateObjectId(organization as string)) {
				return res.status(400).json({ message: "Invalid organization ID" });
			}
			query.organizations = organization;
		}

		// Filter by cause
		if (cause) {
			if (!validateObjectId(cause as string)) {
				return res.status(400).json({ message: "Invalid cause ID" });
			}
			query.causes = cause;
		}

		// Filter by tag
		if (tag) {
			query.tags = tag;
		}

		// Filter by date range
		if (startDate || endDate) {
			query.startDate = {};
			if (startDate) query.startDate.$gte = new Date(startDate as string);
			if (endDate) query.startDate.$lte = new Date(endDate as string);
		}

		const sort: any = {};
		sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

		const campaigns = await Campaign.find(query)
			.populate("organizations", "name email phone")
			.populate("causes", "title description")
			.sort(sort)
			.skip((Number(page) - 1) * Number(limit))
			.limit(Number(limit));

		const total = await Campaign.countDocuments(query);

		res.status(200).json({
			success: true,
			data: campaigns,
			pagination: {
				total,
				page: Number(page),
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching campaigns",
			error: error?.message || "Unknown error occurred",
		});
	}
};

// Get campaign details with donation statistics
export const getCampaignDetails = async (req: Request, res: Response) => {
	try {
		const { campaignId } = req.params;

		if (!validateObjectId(campaignId)) {
			return res.status(400).json({ message: "Invalid campaign ID" });
		}

		const campaign = await Campaign.findById(campaignId)
			.populate("organizations", "name email phone address")
			.populate("causes", "title description targetAmount raisedAmount");

		if (!campaign) {
			return res.status(404).json({ message: "Campaign not found" });
		}

		// Get donation statistics
		const donationStats = await Donation.aggregate([
			{
				$match: {
					campaign: campaign._id,
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
				campaign,
				donationStats,
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error fetching campaign details",
			error: error?.message || "Unknown error occurred",
		});
	}
};

// Update campaign
export const updateCampaign = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const { campaignId } = req.params;
		const updateData = req.body;

		if (!validateObjectId(campaignId)) {
			return res.status(400).json({ message: "Invalid campaign ID" });
		}

		const campaign = await Campaign.findById(campaignId);

		if (!campaign) {
			return res.status(404).json({ message: "Campaign not found" });
		}

		// Check if user is from one of the campaign organizations
		if (!campaign.organizations.includes(req.user._id)) {
			return res
				.status(403)
				.json({ message: "Not authorized to update this campaign" });
		}

		// Prevent updating certain fields
		delete updateData.totalRaisedAmount;
		delete updateData.totalSupporters;
		delete updateData.createdAt;
		delete updateData.updatedAt;

		// Validate organization IDs if provided
		if (updateData.organizations) {
			for (const orgId of updateData.organizations) {
				if (!validateObjectId(orgId)) {
					return res
						.status(400)
						.json({ message: `Invalid organization ID: ${orgId}` });
				}
			}
		}

		// Validate cause IDs if provided
		if (updateData.causes) {
			for (const causeId of updateData.causes) {
				if (!validateObjectId(causeId)) {
					return res
						.status(400)
						.json({ message: `Invalid cause ID: ${causeId}` });
				}
			}
		}

		const updatedCampaign = await Campaign.findByIdAndUpdate(
			campaignId,
			{ $set: updateData },
			{ new: true, runValidators: true }
		)
			.populate("organizations", "name email phone")
			.populate("causes", "title description");

		res.status(200).json({
			success: true,
			data: updatedCampaign,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error updating campaign",
			error: error?.message || "Unknown error occurred",
		});
	}
};

// Update campaign status
export const updateCampaignStatus = async (req: Request, res: Response) => {
	try {
		if (!req.user?._id) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const { campaignId } = req.params;
		const { status } = req.body;

		if (!validateObjectId(campaignId)) {
			return res.status(400).json({ message: "Invalid campaign ID" });
		}

		const campaign = await Campaign.findById(campaignId);

		if (!campaign) {
			return res.status(404).json({ message: "Campaign not found" });
		}

		// Check if user is from one of the campaign organizations
		if (!campaign.organizations.includes(req.user._id)) {
			return res
				.status(403)
				.json({ message: "Not authorized to update this campaign" });
		}

		// Validate status
		const validStatuses = ["draft", "active", "completed", "cancelled"];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({ message: "Invalid status" });
		}

		campaign.status = status;
		await campaign.save();

		res.status(200).json({
			success: true,
			data: campaign,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			message: "Error updating campaign status",
			error: error?.message || "Unknown error occurred",
		});
	}
};
