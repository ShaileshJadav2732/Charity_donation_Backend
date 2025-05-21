import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause, { ICause } from "../models/cause.model";
import Donation from "../models/donation.model";
import Campaign from "../models/campaign.model";
import Organization from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { validateObjectId } from "../utils/validation";

// Extended Request interface with user property
interface RequestWithUser extends Request {
	user?: any; // Using any for now, but ideally should match your user type
}

interface AuthRequest extends Request {
	user?: IUser;
}

// Helper function to format cause response for frontend
const formatCauseResponse = (cause: any) => ({
	id: cause._id.toString(),
	title: cause.title,
	description: cause.description,
	targetAmount: cause.targetAmount,
	raisedAmount: cause.raisedAmount,
	imageUrl: cause.imageUrl,
	tags: cause.tags,
	organizationId:
		cause.organizationId?._id?.toString() ||
		cause.organizationId?.toString() ||
		"",
	organizationName: cause.organizationId?.name || "",
	acceptanceType: cause.acceptanceType || "money",
	donationItems: cause.donationItems || [],
	acceptedDonationTypes: cause.acceptedDonationTypes || ["MONEY"],
	createdAt: cause.createdAt.toISOString(),
	updatedAt: cause.updatedAt.toISOString(),
});

// Get all causes with pagination and filters
export const getCauses = catchAsync(async (req: Request, res: Response) => {
	const page = parseInt(req.query.page as string) || 1;
	const limit = parseInt(req.query.limit as string) || 10;
	const search = req.query.search as string;
	const tag = req.query.tag as string;

	const query: any = {};

	if (search) {
		query.$text = { $search: search };
	}

	if (tag) {
		query.tags = tag;
	}

	const skip = (page - 1) * limit;

	const [causes, total] = await Promise.all([
		Cause.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.populate("organizationId", "name"),
		Cause.countDocuments(query),
	]);

	res.status(200).json({
		causes: causes.map(formatCauseResponse),
		total,
		page,
		limit,
	});
});

// Get a single cause by ID
export const getCauseById = catchAsync(async (req: RequestWithUser, res: Response) => {
	const causeId = req.params.id;
	console.log(`[getCauseById] Request received for cause ID: ${causeId}`);
	console.log(`[getCauseById] Request user:`, req.user);

	if (!mongoose.Types.ObjectId.isValid(causeId)) {
		console.log(`[getCauseById] Invalid cause ID format: ${causeId}`);
		throw new AppError("Invalid cause ID", 400);
	}

	try {
		const cause = await Cause.findById(causeId).populate(
			"organizationId",
			"name"
		);

		if (!cause) {
			console.log(`[getCauseById] Cause not found with ID: ${causeId}`);
			throw new AppError("Cause not found", 404);
		}

		console.log(`[getCauseById] Successfully found cause: ${cause.title}`);

		const formattedCause = formatCauseResponse(cause);
		console.log(`[getCauseById] Formatted cause:`, formattedCause);

		res.status(200).json({
			cause: formattedCause,
		});
	} catch (error) {
		console.error(`[getCauseById] Error finding cause:`, error);
		throw error;
	}
});
// Create a new cause (organization only)

export const createCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		const {
			title,
			description,
			targetAmount,
			imageUrl,
			tags,
			acceptanceType,
			donationItems,
			acceptedDonationTypes
		} = req.body;

		// Validate required fields
		if (!title || !description || targetAmount === undefined || !imageUrl) {
			throw new AppError("Missing required fields", 400);
		}

		if (targetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
		}

		//  Find the organization based on the logged-in user's ID
		const organization = await Organization.findOne({ userId: req.user._id });

		if (!organization) {
			throw new AppError("Organization not found for the logged-in user", 404);
		}

		// Determine the acceptance type and donation items based on input
		const finalAcceptanceType = acceptanceType || "money";
		let finalDonationItems = [];
		let finalAcceptedDonationTypes = ["MONEY"];

		if (finalAcceptanceType === "items" || finalAcceptanceType === "both") {
			finalDonationItems = donationItems || [];

			if (acceptedDonationTypes && acceptedDonationTypes.length > 0) {
				finalAcceptedDonationTypes = finalAcceptanceType === "both"
					? ["MONEY", ...acceptedDonationTypes.filter((type: string) => type !== "MONEY")]
					: acceptedDonationTypes;
			} else if (finalDonationItems.length > 0) {
				// If no acceptedDonationTypes provided but donationItems exist, infer types
				const inferredTypes = finalDonationItems.map((item: string) => {
					switch (item.toUpperCase()) {
						case 'CLOTHES': return "CLOTHES";
						case 'BOOKS': return "BOOKS";
						case 'TOYS': return "TOYS";
						case 'FOOD': return "FOOD";
						case 'FURNITURE': return "FURNITURE";
						case 'HOUSEHOLD ITEMS': return "HOUSEHOLD";
						default: return "OTHER";
					}
				});

				finalAcceptedDonationTypes = finalAcceptanceType === "both"
					? ["MONEY", ...inferredTypes]
					: inferredTypes;
			}
		}

		//  Use organization._id as the reference
		const cause = await Cause.create({
			title,
			description,
			targetAmount,
			imageUrl,
			tags: tags || [],
			organizationId: organization._id,
			acceptanceType: finalAcceptanceType,
			donationItems: finalDonationItems,
			acceptedDonationTypes: finalAcceptedDonationTypes,
		});

		await cause.populate("organizationId", "name");

		res.status(201).json({
			cause: formatCauseResponse(cause),
		});
	}
);

// Update an existing cause (organization only)
export const updateCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		const causeId = await Cause.findById(req.params.id);

		if (!causeId) {
			throw new AppError("Cause not found", 404);
		}
		console.log("--------------------", causeId);
		// Check if user's organization owns the cause
		if (!req.user._id && req.user.role === "organization") {
			throw Error("User Is not Authenticated ");
		}

		const {
			title,
			description,
			targetAmount,
			imageUrl,
			tags,
			acceptanceType,
			donationItems,
			acceptedDonationTypes
		} = req.body;

		// Validate targetAmount if provided
		if (targetAmount !== undefined && targetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
		}
		const cause = causeId;

		// Process donation-related fields
		let finalAcceptanceType = acceptanceType;
		let finalDonationItems = donationItems;
		let finalAcceptedDonationTypes = acceptedDonationTypes;

		// If acceptanceType is provided, update related fields accordingly
		if (finalAcceptanceType) {
			if (finalAcceptanceType === "money") {
				// For money-only, clear item-related fields
				finalDonationItems = [];
				finalAcceptedDonationTypes = ["MONEY"];
			} else if (finalAcceptanceType === "items" || finalAcceptanceType === "both") {
				// For items or both, ensure we have the right donation types
				if (finalDonationItems && finalDonationItems.length > 0) {
					// If donationItems provided but no acceptedDonationTypes, infer them
					if (!finalAcceptedDonationTypes || finalAcceptedDonationTypes.length === 0) {
						const inferredTypes = finalDonationItems.map((item: string) => {
							switch (item.toUpperCase()) {
								case 'CLOTHES': return "CLOTHES";
								case 'BOOKS': return "BOOKS";
								case 'TOYS': return "TOYS";
								case 'FOOD': return "FOOD";
								case 'FURNITURE': return "FURNITURE";
								case 'HOUSEHOLD ITEMS': return "HOUSEHOLD";
								default: return "OTHER";
							}
						});

						finalAcceptedDonationTypes = finalAcceptanceType === "both"
							? ["MONEY", ...inferredTypes]
							: inferredTypes;
					} else if (finalAcceptanceType === "both" && !finalAcceptedDonationTypes.includes("MONEY")) {
						// Ensure MONEY is included for "both" type
						finalAcceptedDonationTypes = ["MONEY", ...finalAcceptedDonationTypes];
					}
				}
			}
		}

		// Update fields
		cause.set({
			title: title || cause.title,
			description: description || cause.description,
			targetAmount:
				targetAmount !== undefined ? targetAmount : cause.targetAmount,
			imageUrl: imageUrl || cause.imageUrl,
			tags: tags || cause.tags,
			...(finalAcceptanceType && { acceptanceType: finalAcceptanceType }),
			...(finalDonationItems && { donationItems: finalDonationItems }),
			...(finalAcceptedDonationTypes && { acceptedDonationTypes: finalAcceptedDonationTypes }),
		});

		await cause.save();

		await cause.populate("organizationId", "name");

		res.status(200).json({
			cause: formatCauseResponse(cause),
		});
	}
);

// Delete a cause (organization only)
export const deleteCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		const cause = await Cause.findById(req.params.id);

		if (!cause) {
			throw new AppError("Cause not found", 404);
		}

		// Find the organization based on the logged-in user's ID
		const organization = await Organization.findOne({ userId: req.user._id });

		if (!organization) {
			throw new AppError("Organization not found for the logged-in user", 404);
		}

		// Check if user's organization owns the cause
		if (!cause.organizationId.equals(organization._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to delete this cause",
				403
			);
		}

		await cause.deleteOne();

		res.status(204).json({});
	}
);

// Get causes owned by a specific organization
export const getOrganizationCauses = catchAsync(
	async (req: Request, res: Response) => {
		const { organizationId } = req.params;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;
		const tag = req.query.tag as string;

		if (!mongoose.Types.ObjectId.isValid(organizationId)) {
			throw new AppError("Invalid organization ID", 400);
		}

		const query: any = { organizationId };

		if (search) {
			query.$text = { $search: search };
		}

		if (tag) {
			query.tags = tag;
		}

		const skip = (page - 1) * limit;

		const [causes, total] = await Promise.all([
			Cause.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("organizationId", "name"),
			Cause.countDocuments(query),
		]);

		res.status(200).json({
			causes: causes.map(formatCauseResponse),
			total,
			page,
			limit,
		});
	}
);

// Get causes supported by the authenticated donor
export const getDonorCauses = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;
		const tag = req.query.tag as string;

		// Find donations by the donor
		const donationQuery: any = { donorId: req.user._id };

		const donations = await Donation.find(donationQuery)
			.select("causeId")
			.distinct("causeId");

		if (!donations.length) {
			return res.status(200).json({
				causes: [],
				total: 0,
				page,
				limit,
			});
		}

		// Query causes based on donation causeIds
		const causeQuery: any = { _id: { $in: donations } };

		if (search) {
			causeQuery.$text = { $search: search };
		}

		if (tag) {
			causeQuery.tags = tag;
		}

		const skip = (page - 1) * limit;

		const [causes, total] = await Promise.all([
			Cause.find(causeQuery)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("organizationId", "name"),
			Cause.countDocuments(causeQuery),
		]);

		res.status(200).json({
			causes: causes.map(formatCauseResponse),
			total,
			page,
			limit,
		});
	}
);

export const getCauseDetailsById = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Validate ObjectId format
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({ message: "Invalid cause ID format" });
		}

		const cause = await Cause.findById(id).populate(
			"organizationId",
			"name email"
		);

		if (!cause) {
			return res.status(404).json({ message: "Cause not found" });
		}

		res.status(200).json({ success: true, data: cause });
	} catch (error) {
		console.error("Error fetching cause by ID:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

// Get causes that are associated with active campaigns only
export const getActiveCampaignCauses = catchAsync(
	async (req: Request, res: Response) => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;
		const tag = req.query.tag as string;

		try {
			console.log("Getting causes from active campaigns");

			// First get all active campaigns
			const activeCampaigns = await Campaign.find({ status: "active" }).select(
				"_id causes"
			);

			// Extract all cause IDs from active campaigns
			const activeCausesIds = new Set<string>();
			activeCampaigns.forEach((campaign) => {
				if (Array.isArray(campaign.causes)) {
					campaign.causes.forEach((causeId: mongoose.Types.ObjectId | null) => {
						if (causeId) {
							activeCausesIds.add(causeId.toString());
						}
					});
				}
			});

			console.log(
				`Found ${activeCausesIds.size} unique causes from active campaigns`
			);

			// Build query for causes
			const query: any = {
				_id: { $in: Array.from(activeCausesIds) },
			};

			if (search) {
				query.$text = { $search: search };
			}

			if (tag) {
				query.tags = tag;
			}

			const skip = (page - 1) * limit;

			// Query for causes that are in active campaigns
			const [causes, total] = await Promise.all([
				Cause.find(query)
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.populate("organizationId", "name"),
				Cause.countDocuments(query),
			]);

			console.log(`Returning ${causes.length} causes from active campaigns`);

			res.status(200).json({
				causes: causes.map(formatCauseResponse),
				total,
				page,
				limit,
			});
		} catch (error) {
			console.error("Error fetching active campaign causes:", error);
			throw new AppError("Error fetching active campaign causes", 500);
		}
	}
);
