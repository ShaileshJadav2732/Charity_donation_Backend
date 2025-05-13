// backend/controllers/campaign.controller.ts
import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Campaign, { CampaignStatus, CampaignUpdate } from "../models/campaign.model";
import Cause from "../models/cause.model";
import OrganizationProfile from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { DonationType, IDonation } from "../models/donation.model";
import { uploadToCloudinary } from "../utils/cloudinary";
import { sendEmail } from "../utils/email";
import { AuthRequest } from "../types";

// Helper function to format campaign response for frontend
const formatCampaignResponse = (campaign: any) => ({
	success: true,
	data: {
		_id: campaign._id.toString(),
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
	},
	message: "Campaign retrieved successfully"
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
		success: true,
		data: {
			campaigns: campaigns.map(formatCampaignResponse),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit)
		},
		message: "Campaigns retrieved successfully"
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

		// Get campaign updates
		const updates = await CampaignUpdate.find({ campaign: campaign._id })
			.sort({ createdAt: -1 });

		res.status(200).json({
			success: true,
			data: {
				...campaign.toObject(),
				updates,
			},
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
	const imageFile = req.file;

	// Validate required fields
	if (!title || !description || !causes?.length || !acceptedDonationTypes?.length || !startDate || !endDate || !imageUrl || !status || !targetAmount || !targetQuantity || !donationType || !location || !requirements || !impact) {
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

	let image;
	if (imageFile) {
		const uploadResult = await uploadToCloudinary(imageFile.path, "campaigns");
		image = uploadResult.secure_url;
	}

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
		tags,
		totalTargetAmount,
		totalRaisedAmount: 0,
		totalSupporters: 0,
		status: status,
		targetAmount,
		currentAmount: 0,
		targetQuantity,
		currentQuantity: 0,
		donationType,
		location,
		requirements: requirements ? JSON.parse(requirements) : [],
		impact,
	});

	// Populate related data
	await campaign.populate({
		path: "causes",
		select: "title targetAmount raisedAmount organizationId",
		populate: {
			path: "organizationId",
			select: "name"
		}
	});
	await campaign.populate("organizations", "name");

	res.status(201).json({
		success: true,
		data: formatCampaignResponse(campaign).data,
		message: "Campaign created successfully"
	});
});

// Update campaign
export const updateCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user || req.user.role !== "organization") {
		throw new AppError("Unauthorized: Only organizations can update campaigns", 403);
	}

	const campaign = await Campaign.findById(req.params.id);
	if (!campaign) {
		throw new AppError("Campaign not found", 404);
	}

	// Check if user's organization is associated with the campaign
	if (!campaign.organizations.some(orgId => orgId.equals(new Types.ObjectId(req.user!._id)))) {
		throw new AppError("Unauthorized: You do not have permission to modify this campaign", 403);
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
		location,
		requirements,
		impact,
	} = req.body;
	const imageFile = req.file;

	// Validate causes if provided
	if (causes) {
		const causeIds = causes.map((id: string) => new Types.ObjectId(id));
		const validCauses = await Cause.find({
			_id: { $in: causeIds },
			organizationId: new Types.ObjectId(req.user._id)
		});

		if (validCauses.length !== causes.length) {
			throw new AppError("Invalid or unauthorized cause IDs", 400);
		}

		// Update total target amount based on new causes
		campaign.totalTargetAmount = validCauses.reduce((sum, cause) => sum + cause.targetAmount, 0);
		campaign.causes = causeIds;
	}

	// Validate dates if provided
	if (startDate || endDate) {
		const start = startDate ? new Date(startDate) : campaign.startDate;
		const end = endDate ? new Date(endDate) : campaign.endDate;

		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			throw new AppError("Invalid date format", 400);
		}
		if (start >= end) {
			throw new AppError("End date must be after start date", 400);
		}

		campaign.startDate = start;
		campaign.endDate = end;
	}

	// Validate donation types if provided
	if (acceptedDonationTypes) {
		const validDonationTypes = Object.values(DonationType);
		const invalidTypes = acceptedDonationTypes.filter((type: string) => !validDonationTypes.includes(type as DonationType));
		if (invalidTypes.length > 0) {
			throw new AppError(`Invalid donation types: ${invalidTypes.join(", ")}`, 400);
		}
		campaign.acceptedDonationTypes = acceptedDonationTypes as DonationType[];
	}

	// Update other fields if provided
	if (title) campaign.title = title;
	if (description) campaign.description = description;
	if (imageUrl) campaign.imageUrl = imageUrl;
	if (tags) campaign.tags = tags;
	if (status) campaign.status = status;
	if (targetAmount) campaign.targetAmount = targetAmount;
	if (targetQuantity) campaign.targetQuantity = targetQuantity;
	if (location) campaign.location = location;
	if (requirements) campaign.requirements = requirements ? JSON.parse(requirements) : [];
	if (impact) campaign.impact = impact;

	let image = campaign.imageUrl;
	if (imageFile) {
		const uploadResult = await uploadToCloudinary(imageFile.path, "campaigns");
		image = uploadResult.secure_url;
	}
	campaign.imageUrl = image;

	await campaign.save();

	// Populate related data
	await campaign.populate({
		path: "causes",
		select: "title targetAmount raisedAmount organizationId",
		populate: {
			path: "organizationId",
			select: "name"
		}
	});
	await campaign.populate("organizations", "name");

	res.status(200).json({
		success: true,
		data: formatCampaignResponse(campaign).data,
		message: "Campaign updated successfully"
	});
});

// Delete campaign
export const deleteCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user || req.user.role !== "organization") {
		throw new AppError("Unauthorized: Only organizations can delete campaigns", 403);
	}

	const campaign = await Campaign.findById(req.params.id);
	if (!campaign) {
		throw new AppError("Campaign not found", 404);
	}

	// Check if user's organization is associated with the campaign
	if (!campaign.organizations.some(orgId => orgId.equals(new Types.ObjectId(req.user!._id)))) {
		throw new AppError("Unauthorized: You do not have permission to delete this campaign", 403);
	}

	// Check if campaign has any donations
	const hasDonations = await mongoose.model<IDonation>("Donation").exists({ campaignId: campaign._id });
	if (hasDonations) {
		throw new AppError("Cannot delete campaign with existing donations", 400);
	}

	// Delete campaign updates
	await CampaignUpdate.deleteMany({ campaign: campaign._id });
	await campaign.deleteOne();

	res.status(204).send();
});

// Add a cause to a campaign
export const addCauseToCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user || req.user.role !== "organization") {
		throw new AppError("Unauthorized: Only organizations can modify campaigns", 403);
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
	if (!campaign.organizations.some(orgId => orgId.equals(new Types.ObjectId(req.user!._id)))) {
		throw new AppError("Unauthorized: You do not have permission to modify this campaign", 403);
	}

	// Check if cause belongs to one of the campaign's organizations
	if (!cause.organizationId.equals(new Types.ObjectId(req.user._id))) {
		throw new AppError("Cause does not belong to your organization", 403);
	}

	if (campaign.causes.some(id => id.equals(new Types.ObjectId(causeId)))) {
		throw new AppError("Cause already added to campaign", 400);
	}

	campaign.causes.push(new Types.ObjectId(causeId));
	await campaign.save();

	await campaign.populate({
		path: "causes",
		select: "title targetAmount raisedAmount organizationId",
		populate: {
			path: "organizationId",
			select: "name"
		}
	});
	await campaign.populate("organizations", "name");

	res.status(200).json({
		success: true,
		data: formatCampaignResponse(campaign).data,
		message: "Cause added to campaign successfully"
	});
});

// Remove a cause from a campaign
export const removeCauseFromCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user || req.user.role !== "organization") {
		throw new AppError("Unauthorized: Only organizations can modify campaigns", 403);
	}

	const campaign = await Campaign.findById(req.params.id);

	if (!campaign) {
		throw new AppError("Campaign not found", 404);
	}

	// Check if user's organization is associated with the campaign
	if (!campaign.organizations.some(orgId => orgId.equals(new Types.ObjectId(req.user!._id)))) {
		throw new AppError("Unauthorized: You do not have permission to modify this campaign", 403);
	}

	const causeId = new Types.ObjectId(req.params.causeId);

	if (!campaign.causes.some(id => id.equals(causeId))) {
		throw new AppError("Cause not found in campaign", 400);
	}

	campaign.causes = campaign.causes.filter((id) => !id.equals(causeId));
	await campaign.save();

	await campaign.populate({
		path: "causes",
		select: "title targetAmount raisedAmount organizationId",
		populate: {
			path: "organizationId",
			select: "name"
		}
	});
	await campaign.populate("organizations", "name");

	res.status(200).json({
		success: true,
		data: formatCampaignResponse(campaign).data,
		message: "Cause removed from campaign successfully"
	});
});

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
		if (!campaign.organizations.some(orgId => orgId.equals(new Types.ObjectId(req.user!._id)))) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		const orgObjectId = new Types.ObjectId(organizationId);
		if (campaign.organizations.some(id => id.equals(orgObjectId))) {
			throw new AppError("Organization already added to campaign", 400);
		}

		campaign.organizations.push(orgObjectId);
		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign).data,
			message: "Organization added to campaign successfully"
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
		if (!campaign.organizations.some(orgId => orgId.equals(new Types.ObjectId(req.user!._id)))) {
			throw new AppError(
				"Unauthorized: You do not have permission to modify this campaign",
				403
			);
		}

		const organizationId = new Types.ObjectId(req.params.organizationId);

		if (!campaign.organizations.some(id => id.equals(organizationId))) {
			throw new AppError("Organization not found in campaign", 400);
		}

		// Prevent removing the last organization
		if (campaign.organizations.length === 1) {
			throw new AppError("Campaign must have at least one organization", 400);
		}

		campaign.organizations = campaign.organizations.filter(
			(id) => !id.equals(organizationId)
		);
		await campaign.save();

		await campaign.populate("causes", "title targetAmount raisedAmount");
		await campaign.populate("organizations", "name");

		res.status(200).json({
			success: true,
			data: formatCampaignResponse(campaign).data,
			message: "Organization removed from campaign successfully"
		});
	}
);

export const createCampaignUpdate = catchAsync(async (req: AuthRequest, res: Response) => {
	try {
		const { title, content } = req.body;
		const imageFile = req.file;

		if (!title || !content) {
			return res.status(400).json({
				success: false,
				error: "Missing required fields",
			});
		}

		const campaign = await Campaign.findById(req.params.id);

		if (!campaign) {
			return res.status(404).json({
				success: false,
				error: "Campaign not found",
			});
		}

		// Only organization can add updates to their campaign
		if (campaign.organization.toString() !== req.user?.id) {
			return res.status(403).json({
				success: false,
				error: "Not authorized to add updates to this campaign",
			});
		}

		let image;
		if (imageFile) {
			const uploadResult = await uploadToCloudinary(imageFile.path, "campaign-updates");
			image = uploadResult.secure_url;
		}

		const update = new CampaignUpdate({
			campaign: campaign._id,
			title,
			content,
			image,
		});

		await update.save();

		// Notify campaign followers about the update
		// TODO: Implement notification system

		res.status(201).json({
			success: true,
			data: update,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
});

export const getCampaignUpdates = catchAsync(async (req: Request, res: Response) => {
	try {
		const updates = await CampaignUpdate.find({ campaign: req.params.id })
			.sort({ createdAt: -1 });

		res.status(200).json({
			success: true,
			data: updates,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "An error occurred",
		});
	}
});
