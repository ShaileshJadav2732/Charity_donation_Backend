import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import Campaign from "../models/campaign.model";
import Organization from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { AuthRequest, AuthUser } from "../types";

// Extended Request interface with user property
interface RequestWithUser extends Request {
	user?: any; // Using any for now, but ideally should match your user type
}

// Helper function to map donation items to their corresponding DonationType
const mapDonationItemToType = (item: string): string => {
	const itemLower = item.toLowerCase();
	if (itemLower.includes("cloth") || itemLower.includes("clothing")) {
		return "CLOTHES";
	} else if (
		itemLower.includes("book") ||
		itemLower.includes("textbook") ||
		itemLower.includes("educational")
	) {
		return "BOOKS";
	} else if (itemLower.includes("toy") || itemLower.includes("game")) {
		return "TOYS";
	} else if (
		itemLower.includes("food") ||
		itemLower.includes("meal") ||
		itemLower.includes("canned")
	) {
		return "FOOD";
	} else if (
		itemLower.includes("furniture") ||
		itemLower.includes("bed") ||
		itemLower.includes("table") ||
		itemLower.includes("chair")
	) {
		return "FURNITURE";
	} else if (
		itemLower.includes("household") ||
		itemLower.includes("kitchen") ||
		itemLower.includes("cleaning") ||
		itemLower.includes("bedding")
	) {
		return "HOUSEHOLD";
	} else if (itemLower.includes("blood")) {
		return "BLOOD";
	} else {
		return "OTHER";
	}
};

// Helper function to calculate raised amount for a cause (money only)
const calculateRaisedAmount = async (causeId: string): Promise<number> => {
	try {
		const result = await Donation.aggregate([
			{
				$match: {
					cause: new mongoose.Types.ObjectId(causeId),
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
					type: "MONEY",
				},
			},
			{
				$group: {
					_id: null,
					totalAmount: { $sum: "$amount" },
				},
			},
		]);

		return result.length > 0 ? result[0].totalAmount || 0 : 0;
	} catch (error) {
		return 0;
	}
};

// Helper function to calculate item donation counts for a cause
const calculateItemDonations = async (causeId: string): Promise<number> => {
	try {
		const result = await Donation.aggregate([
			{
				$match: {
					cause: new mongoose.Types.ObjectId(causeId),
					status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
					type: { $ne: "MONEY" }, // Count all non-monetary donations
				},
			},
			{
				$group: {
					_id: null,
					totalItems: { $sum: { $ifNull: ["$quantity", 1] } }, // Use quantity or default to 1
				},
			},
		]);

		return result.length > 0 ? result[0].totalItems || 0 : 0;
	} catch (error) {
		console.error("Error calculating item donations:", error);
		return 0;
	}
};

// Helper function to calculate total donor count (both money and items)
const calculateDonorCount = async (causeId: string): Promise<number> => {
	try {
		const uniqueDonors = await Donation.distinct("donor", {
			cause: new mongoose.Types.ObjectId(causeId),
			status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
		});

		return uniqueDonors.length;
	} catch (error) {
		console.error("Error calculating donor count:", error);
		return 0;
	}
};

// Helper function to format cause response for frontend
const formatCauseResponse = async (cause: any) => {
	const [raisedAmount, itemDonations, donorCount] = await Promise.all([
		calculateRaisedAmount(cause._id.toString()),
		calculateItemDonations(cause._id.toString()),
		calculateDonorCount(cause._id.toString()),
	]);

	return {
		id: cause._id.toString(),
		title: cause.title,
		description: cause.description,
		targetAmount: cause.targetAmount,
		raisedAmount: raisedAmount, // Money raised
		itemDonations: itemDonations, // Number of items donated
		donorCount: donorCount, // Total unique donors
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
	const donationType = req.query.donationType as string;
	const acceptanceType = req.query.acceptanceType as string;

	const query: any = {};

	// Text search - fallback to regex if text index not available
	if (search) {
		try {
			query.$text = { $search: search };
		} catch (error) {
			// Fallback to regex search if text index doesn't exist
			query.$or = [
				{ title: { $regex: search, $options: "i" } },
				{ description: { $regex: search, $options: "i" } },
				{ tags: { $regex: search, $options: "i" } },
			];
		}
	}

	// Tag filtering
	if (tag) {
		query.tags = { $in: [tag] };
	}

	// Donation type filtering
	if (donationType && donationType !== "all") {
		query.acceptedDonationTypes = { $in: [donationType.toUpperCase()] };
	}

	// Acceptance type filtering
	if (acceptanceType && acceptanceType !== "all") {
		query.acceptanceType = acceptanceType;
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
		causes.map((cause) => formatCauseResponse(cause))
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

		const finalAcceptanceType = acceptanceType || "money";

		if (finalAcceptanceType !== "items" && targetAmount <= 0) {
			throw new AppError(
				"Target amount must be greater than 0 for money-based causes",
				400
			);
		}

		if (finalAcceptanceType === "items" && targetAmount < 0) {
			throw new AppError("Target amount cannot be negative", 400);
		}

		if (
			(finalAcceptanceType === "items" || finalAcceptanceType === "both") &&
			(!donationItems || donationItems.length === 0)
		) {
			throw new AppError(
				"At least one donation item must be selected for item-based causes",
				400
			);
		}

		const organization = await Organization.findOne({ userId: req.user._id });

		if (!organization) {
			throw new AppError("Organization not found for the logged-in user", 404);
		}

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
				const inferredTypes = finalDonationItems.map((item: string) =>
					mapDonationItemToType(item)
				);

				// Remove duplicates from inferred types
				const uniqueInferredTypes = [...new Set(inferredTypes)];

				finalAcceptedDonationTypes =
					finalAcceptanceType === "both"
						? ["MONEY", ...uniqueInferredTypes]
						: uniqueInferredTypes;
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

		if (targetAmount !== undefined) {
			const updateAcceptanceType = acceptanceType || cause.acceptanceType;

			if (updateAcceptanceType !== "items" && targetAmount <= 0) {
				throw new AppError(
					"Target amount must be greater than 0 for money-based causes",
					400
				);
			}

			if (updateAcceptanceType === "items" && targetAmount < 0) {
				throw new AppError("Target amount cannot be negative", 400);
			}
		}

		let finalAcceptanceType = acceptanceType;
		let finalDonationItems = donationItems;
		let finalAcceptedDonationTypes = acceptedDonationTypes;

		if (finalAcceptanceType) {
			if (finalAcceptanceType === "money") {
				finalDonationItems = [];
				finalAcceptedDonationTypes = ["MONEY"];
			} else if (
				finalAcceptanceType === "items" ||
				finalAcceptanceType === "both"
			) {
				if (finalDonationItems && finalDonationItems.length > 0) {
					if (
						!finalAcceptedDonationTypes ||
						finalAcceptedDonationTypes.length === 0
					) {
						const inferredTypes = finalDonationItems.map((item: string) =>
							mapDonationItemToType(item)
						);

						// Remove duplicates from inferred types
						const uniqueInferredTypes = [...new Set(inferredTypes)];

						finalAcceptedDonationTypes =
							finalAcceptanceType === "both"
								? ["MONEY", ...uniqueInferredTypes]
								: uniqueInferredTypes;
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

		const causeId = req.params.id;
		const cause = await Cause.findById(causeId);

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

		// Check if cause has existing donations
		const donations = await Donation.countDocuments({ cause: cause._id });
		if (donations > 0) {
			throw new AppError(
				"Cannot delete cause with existing donations. Please contact support if you need to remove this cause.",
				400
			);
		}

		// Check if cause is associated with any campaigns
		const campaigns = await Campaign.countDocuments({ causes: cause._id });
		if (campaigns > 0) {
			throw new AppError(
				"Cannot delete cause that is associated with campaigns. Please remove the cause from all campaigns first.",
				400
			);
		}

		await cause.deleteOne();

		res.status(200).json({
			success: true,
			message: "Cause deleted successfully",
		});
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
		const donationType = req.query.donationType as string;
		const acceptanceType = req.query.acceptanceType as string;

		if (!mongoose.Types.ObjectId.isValid(organizationId)) {
			throw new AppError("Invalid organization ID", 400);
		}

		const query: any = { organizationId };

		// Text search - fallback to regex if text index not available
		if (search) {
			try {
				query.$text = { $search: search };
			} catch (error) {
				// Fallback to regex search if text index doesn't exist
				query.$or = [
					{ title: { $regex: search, $options: "i" } },
					{ description: { $regex: search, $options: "i" } },
					{ tags: { $regex: search, $options: "i" } },
				];
			}
		}

		// Tag filtering
		if (tag) {
			query.tags = { $in: [tag] };
		}

		// Donation type filtering
		if (donationType && donationType !== "all") {
			query.acceptedDonationTypes = { $in: [donationType.toUpperCase()] };
		}

		// Acceptance type filtering
		if (acceptanceType && acceptanceType !== "all") {
			query.acceptanceType = acceptanceType;
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
			causes.map((cause) => formatCauseResponse(cause))
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
		const donationType = req.query.donationType as string;
		const acceptanceType = req.query.acceptanceType as string;

		try {
			// First get all active campaigns that are currently running
			const now = new Date();
			const activeCampaigns = await Campaign.find({
				status: "active",
				startDate: { $lte: now },
				endDate: { $gte: now },
			}).select("_id causes");

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

			// Convert to ObjectId array for MongoDB query
			const activeCauseObjectIds = Array.from(activeCausesIds).map(
				(id) => new mongoose.Types.ObjectId(id)
			);

			// Build query for causes - FIXED VERSION
			const query: any = {
				_id: { $in: activeCauseObjectIds },
			};

			// Text search - FIXED: Combine with existing _id filter
			if (search) {
				const searchConditions = [
					{ title: { $regex: search, $options: "i" } },
					{ description: { $regex: search, $options: "i" } },
					{ tags: { $regex: search, $options: "i" } },
				];

				// Combine search with the _id filter using $and
				query.$and = [
					{ _id: { $in: activeCauseObjectIds } },
					{ $or: searchConditions },
				];

				// Remove the original _id filter since it's now in $and
				delete query._id;
			}

			// Tag filtering
			if (tag) {
				query.tags = { $in: [tag] };
			}

			// Donation type filtering
			if (donationType && donationType !== "all") {
				query.acceptedDonationTypes = { $in: [donationType.toUpperCase()] };
			}

			// Acceptance type filtering
			if (acceptanceType && acceptanceType !== "all") {
				query.acceptanceType = acceptanceType;
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
				causes.map((cause) => formatCauseResponse(cause))
			);

			res.status(200).json({
				causes: formattedCauses,
				total,
				page,
				limit,
			});
		} catch (error) {
			console.error("Error in getActiveCampaignCauses:", error);
			throw new AppError("Error fetching active campaign causes", 500);
		}
	}
);

// Get campaigns associated with a specific cause
export const getCampaignsForCause = catchAsync(
	async (req: Request, res: Response) => {
		const { causeId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(causeId)) {
			throw new AppError("Invalid cause ID", 400);
		}

		// Find campaigns that include this cause
		const campaigns = await Campaign.find({ causes: causeId })
			.select("_id title status startDate endDate")
			.populate("organizations", "name");

		res.status(200).json({
			success: true,
			data: {
				causeId,
				campaigns: campaigns.map((campaign) => ({
					id: campaign._id.toString(),
					title: campaign.title,
					status: campaign.status,
					startDate: campaign.startDate,
					endDate: campaign.endDate,
					organizations: campaign.organizations,
				})),
			},
		});
	}
);

// Clean up duplicates in existing causes (utility function)
export const cleanupDuplicates = catchAsync(
	async (req: Request, res: Response) => {
		const causes = await Cause.find({});
		let updatedCount = 0;

		for (const cause of causes) {
			let needsUpdate = false;

			// Clean up donationItems duplicates
			if (cause.donationItems && cause.donationItems.length > 0) {
				const uniqueDonationItems = [...new Set(cause.donationItems)];
				if (uniqueDonationItems.length !== cause.donationItems.length) {
					cause.donationItems = uniqueDonationItems;
					needsUpdate = true;
				}
			}

			// Clean up acceptedDonationTypes duplicates
			if (
				cause.acceptedDonationTypes &&
				cause.acceptedDonationTypes.length > 0
			) {
				const uniqueAcceptedTypes = [...new Set(cause.acceptedDonationTypes)];
				if (uniqueAcceptedTypes.length !== cause.acceptedDonationTypes.length) {
					cause.acceptedDonationTypes = uniqueAcceptedTypes;
					needsUpdate = true;
				}
			}

			if (needsUpdate) {
				await cause.save();
				updatedCount++;
			}
		}

		res.status(200).json({
			success: true,
			message: `Cleaned up duplicates in ${updatedCount} causes`,
			data: {
				totalCauses: causes.length,
				updatedCauses: updatedCount,
			},
		});
	}
);

// Get organization User ID from cause ID for messaging
export const getOrganizationUserIdByCauseId = catchAsync(
	async (req: Request, res: Response) => {
		const { causeId } = req.params;

		if (!causeId) {
			throw new AppError("Cause ID is required", 400);
		}

		// Find the cause and populate organization
		const cause = await Cause.findById(causeId).populate(
			"organizationId",
			"name userId email"
		);

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

		console.log("Found Organization:", {
			organizationId: organization._id.toString(),
			organizationName: organization.name,
			organizationUserId: organization.userId.toString(),
		});

		res.status(200).json({
			success: true,
			data: {
				causeId: cause._id.toString(),
				causeTitle: cause.title,
				organizationId: organization._id.toString(),
				organizationName: organization.name,
				organizationUserId: organization.userId.toString(), // This is what we need for messaging
				organizationEmail: organization.email,
			},
		});
	}
);
