import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause, { ICause } from "../models/cause.model";
import Donation from "../models/donation.model";
import Campaign from "../models/campaign.model";
import Organization from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";

// Extended Request interface with user property
interface RequestWithUser extends Request {
	user?: any; // Using any for now, but ideally should match your user type
}

interface AuthRequest extends RequestWithUser {
	user?: IUser;
}

// Helper function to calculate raised amount for a cause
const calculateRaisedAmount = async (causeId: string): Promise<number> => {
	try {
		const result = await Donation.aggregate([
			{
				$match: {
					cause: new mongoose.Types.ObjectId(causeId),
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
					type: "MONEY"
				}
			},
			{
				$group: {
					_id: null,
					totalAmount: { $sum: "$amount" }
				}
			}
		]);

		return result.length > 0 ? result[0].totalAmount || 0 : 0;
	} catch (error) {
		console.error("Error calculating raised amount:", error);
		return 0;
	}
};

// Helper function to format cause response for frontend
const formatCauseResponse = async (cause: any) => {
	const raisedAmount = await calculateRaisedAmount(cause._id.toString());

	return {
		id: cause._id.toString(),
		title: cause.title,
		description: cause.description,
		targetAmount: cause.targetAmount,
		raisedAmount: raisedAmount,
		imageUrl: cause.imageUrl,
		tags: cause.tags,
		organizationId:
			cause.organizationId?._id?.toString() ||
			cause.organizationId?.toString() ||
			"",
		organizationName: cause.organizationId?.name || "",
		organizationUserId: cause.organizationId?.userId?.toString() || "", // Include organization's userId for messaging
		acceptanceType: cause.acceptanceType || "money",
		donationItems: cause.donationItems || [],
		acceptedDonationTypes: cause.acceptedDonationTypes || ["MONEY"],
		createdAt: cause.createdAt.toISOString(),
		updatedAt: cause.updatedAt.toISOString(),
	};
};

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
			.populate("organizationId", "name userId"), // Include userId for messaging
		Cause.countDocuments(query),
	]);

	// Format causes with calculated raised amounts
	const formattedCauses = await Promise.all(
		causes.map(cause => formatCauseResponse(cause))
	);

	res.status(200).json({
		causes: formattedCauses,
		total,
		page,
		limit,
	});
});

// Get a single cause by ID
export const getCauseById = catchAsync(
	async (req: RequestWithUser, res: Response) => {
		const causeId = req.params.id;

		if (!mongoose.Types.ObjectId.isValid(causeId)) {
			throw new AppError("Invalid cause ID", 400);
		}

		try {
			const cause = await Cause.findById(causeId).populate(
				"organizationId",
				"name userId" // Include userId for messaging
			);

			if (!cause) {
				throw new AppError("Cause not found", 404);
			}

			const formattedCause = await formatCauseResponse(cause);

			res.status(200).json({
				cause: formattedCause,
			});
		} catch (error) {
			throw error;
		}
	}
);
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
			acceptedDonationTypes,
		} = req.body;

		// Validate required fields
		if (!title || !description || targetAmount === undefined || !imageUrl) {
			throw new AppError("Missing required fields", 400);
		}

		// Determine the acceptance type to validate targetAmount correctly
		const finalAcceptanceType = acceptanceType || "money";

		// For money or both acceptance types, targetAmount must be > 0
		// For items-only, targetAmount can be 0
		if (finalAcceptanceType !== "items" && targetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0 for money-based causes", 400);
		}

		// For items-only causes, ensure targetAmount is not negative
		if (finalAcceptanceType === "items" && targetAmount < 0) {
			throw new AppError("Target amount cannot be negative", 400);
		}

		// For items or both acceptance types, ensure donation items are provided
		if ((finalAcceptanceType === "items" || finalAcceptanceType === "both") &&
			(!donationItems || donationItems.length === 0)) {
			throw new AppError("At least one donation item must be selected for item-based causes", 400);
		}

		//  Find the organization based on the logged-in user's ID
		const organization = await Organization.findOne({ userId: req.user._id });

		if (!organization) {
			throw new AppError("Organization not found for the logged-in user", 404);
		}

		// Use the already determined acceptance type for donation items processing
		// finalAcceptanceType is already defined above
		let finalDonationItems = [];
		let finalAcceptedDonationTypes = ["MONEY"];

		if (finalAcceptanceType === "items" || finalAcceptanceType === "both") {
			finalDonationItems = donationItems || [];

			if (acceptedDonationTypes && acceptedDonationTypes.length > 0) {
				finalAcceptedDonationTypes =
					finalAcceptanceType === "both"
						? [
							"MONEY",
							...acceptedDonationTypes.filter(
								(type: string) => type !== "MONEY"
							),
						]
						: acceptedDonationTypes;
			} else if (finalDonationItems.length > 0) {
				// If no acceptedDonationTypes provided but donationItems exist, infer types
				const inferredTypes = finalDonationItems.map((item: string) => {
					switch (item.toUpperCase()) {
						case "CLOTHES":
							return "CLOTHES";
						case "BOOKS":
							return "BOOKS";
						case "TOYS":
							return "TOYS";
						case "FOOD":
							return "FOOD";
						case "FURNITURE":
							return "FURNITURE";
						case "HOUSEHOLD ITEMS":
							return "HOUSEHOLD";
						default:
							return "OTHER";
					}
				});

				finalAcceptedDonationTypes =
					finalAcceptanceType === "both"
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

		await cause.populate("organizationId", "name userId");

		const formattedCause = await formatCauseResponse(cause);

		res.status(201).json({
			cause: formattedCause,
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
			acceptedDonationTypes,
		} = req.body;

		const cause = causeId;

		// Validate targetAmount if provided
		if (targetAmount !== undefined) {
			const updateAcceptanceType = acceptanceType || cause.acceptanceType;

			// For money or both acceptance types, targetAmount must be > 0
			// For items-only, targetAmount can be 0
			if (updateAcceptanceType !== "items" && targetAmount <= 0) {
				throw new AppError("Target amount must be greater than 0 for money-based causes", 400);
			}

			// For items-only causes, ensure targetAmount is not negative
			if (updateAcceptanceType === "items" && targetAmount < 0) {
				throw new AppError("Target amount cannot be negative", 400);
			}
		}

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
			} else if (
				finalAcceptanceType === "items" ||
				finalAcceptanceType === "both"
			) {
				// For items or both, ensure we have the right donation types
				if (finalDonationItems && finalDonationItems.length > 0) {
					// If donationItems provided but no acceptedDonationTypes, infer them
					if (
						!finalAcceptedDonationTypes ||
						finalAcceptedDonationTypes.length === 0
					) {
						const inferredTypes = finalDonationItems.map((item: string) => {
							switch (item.toUpperCase()) {
								case "CLOTHES":
									return "CLOTHES";
								case "BOOKS":
									return "BOOKS";
								case "TOYS":
									return "TOYS";
								case "FOOD":
									return "FOOD";
								case "FURNITURE":
									return "FURNITURE";
								case "HOUSEHOLD ITEMS":
									return "HOUSEHOLD";
								default:
									return "OTHER";
							}
						});

						finalAcceptedDonationTypes =
							finalAcceptanceType === "both"
								? ["MONEY", ...inferredTypes]
								: inferredTypes;
					} else if (
						finalAcceptanceType === "both" &&
						!finalAcceptedDonationTypes.includes("MONEY")
					) {
						// Ensure MONEY is included for "both" type
						finalAcceptedDonationTypes = [
							"MONEY",
							...finalAcceptedDonationTypes,
						];
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
			...(finalAcceptedDonationTypes && {
				acceptedDonationTypes: finalAcceptedDonationTypes,
			}),
		});

		await cause.save();

		await cause.populate("organizationId", "name userId");

		const formattedCause = await formatCauseResponse(cause);

		res.status(200).json({
			cause: formattedCause,
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
				.populate("organizationId", "name userId"),
			Cause.countDocuments(query),
		]);

		// Format causes with calculated raised amounts
		const formattedCauses = await Promise.all(
			causes.map(cause => formatCauseResponse(cause))
		);

		res.status(200).json({
			causes: formattedCauses,
			total,
			page,
			limit,
		});
	}
);

// Get causes that are associated with active campaigns only
export const getActiveCampaignCauses = catchAsync(
	async (req: Request, res: Response) => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;
		const tag = req.query.tag as string;

		try {
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

			// Format causes with calculated raised amounts
			const formattedCauses = await Promise.all(
				causes.map(cause => formatCauseResponse(cause))
			);

			res.status(200).json({
				causes: formattedCauses,
				total,
				page,
				limit,
			});
		} catch (error) {
			throw new AppError("Error fetching active campaign causes", 500);
		}
	}
);

// Get organization User ID from cause ID for messaging
export const getOrganizationUserIdByCauseId = catchAsync(
	async (req: Request, res: Response) => {
		const { causeId } = req.params;

		if (!causeId) {
			throw new AppError("Cause ID is required", 400);
		}

		console.log('=== GET ORGANIZATION USER ID BY CAUSE ID ===');
		console.log('Cause ID:', causeId);

		// Find the cause and populate organization
		const cause = await Cause.findById(causeId).populate('organizationId', 'name userId email');

		if (!cause) {
			throw new AppError("Cause not found", 404);
		}

		const organization = cause.organizationId as any;

		if (!organization) {
			throw new AppError("Organization not found for this cause", 404);
		}

		if (!organization.userId) {
			throw new AppError("Organization User ID not found", 404);
		}

		console.log('Found Organization:', {
			organizationId: organization._id.toString(),
			organizationName: organization.name,
			organizationUserId: organization.userId.toString()
		});
		console.log('=======================================');

		res.status(200).json({
			success: true,
			data: {
				causeId: cause._id.toString(),
				causeTitle: cause.title,
				organizationId: organization._id.toString(),
				organizationName: organization.name,
				organizationUserId: organization.userId.toString(), // This is what we need for messaging
				organizationEmail: organization.email
			}
		});
	}
);
