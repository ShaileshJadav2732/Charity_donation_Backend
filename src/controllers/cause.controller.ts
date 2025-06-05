import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import Campaign from "../models/campaign.model";
import Organization from "../models/organization.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";

interface AuthRequest extends Omit<Request, "user"> {
	user?: IUser;
}

// Helper to calculate cause stats
const calculateStats = async (causeId: string) => {
	try {
		const [moneyResult, itemResult, uniqueDonors] = await Promise.all([
			Donation.aggregate([
				{
					$match: {
						cause: new mongoose.Types.ObjectId(causeId),
						status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
						type: "MONEY",
					},
				},
				{ $group: { _id: null, totalAmount: { $sum: "$amount" } } },
			]),
			Donation.aggregate([
				{
					$match: {
						cause: new mongoose.Types.ObjectId(causeId),
						status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
						type: { $ne: "MONEY" },
					},
				},
				{
					$group: {
						_id: null,
						totalItems: { $sum: { $ifNull: ["$quantity", 1] } },
					},
				},
			]),
			Donation.distinct("donor", {
				cause: new mongoose.Types.ObjectId(causeId),
				status: { $in: ["APPROVED", "RECEIVED", "CONFIRMED"] },
			}),
		]);

		return {
			raisedAmount: moneyResult[0]?.totalAmount || 0,
			itemDonations: itemResult[0]?.totalItems || 0,
			donorCount: uniqueDonors.length,
		};
	} catch (error) {
		return { raisedAmount: 0, itemDonations: 0, donorCount: 0 };
	}
};

// Helper to format cause response
const formatResponse = async (cause: any) => {
	const { raisedAmount, itemDonations, donorCount } = await calculateStats(
		cause._id.toString()
	);

	return {
		id: cause._id.toString(),
		title: cause.title,
		description: cause.description,
		targetAmount: cause.targetAmount,
		raisedAmount,
		itemDonations,
		donorCount,
		imageUrl: cause.imageUrl,
		tags: cause.tags,
		organizationId:
			cause.organizationId?._id?.toString() ||
			cause.organizationId?.toString() ||
			"",
		organizationName: cause.organizationId?.name || "",
		organizationUserId: cause.organizationId?.userId?.toString() || "",
		acceptanceType: cause.acceptanceType || "money",
		donationItems: cause.donationItems || [],
		acceptedDonationTypes: cause.acceptedDonationTypes || ["MONEY"],
		createdAt: cause.createdAt.toISOString(),
		updatedAt: cause.updatedAt.toISOString(),
	};
};

export const getCauses = catchAsync(async (req: Request, res: Response) => {
	const page = parseInt(req.query.page as string) || 1;
	const limit = parseInt(req.query.limit as string) || 20;
	const search = req.query.search as string;
	const tag = req.query.tag as string;

	const query: any = {};
	if (search) query.$text = { $search: search };
	if (tag) query.tags = tag;

	const [causes, total] = await Promise.all([
		Cause.find(query)
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.populate("organizationId", "name userId"),
		Cause.countDocuments(query),
	]);

	const formattedCauses = await Promise.all(
		causes.map((cause) => formatResponse(cause))
	);

	res.status(200).json({ causes: formattedCauses, total, page, limit });
});

export const getCauseById = catchAsync(async (req: Request, res: Response) => {
	if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
		throw new AppError("Invalid cause ID", 400);
	}

	const cause = await Cause.findById(req.params.id).populate(
		"organizationId",
		"name userId"
	);
	if (!cause) throw new AppError("Cause not found", 404);

	res.status(200).json({ cause: await formatResponse(cause) });
});
export const createCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user)
			throw new AppError("Unauthorized: Authentication required", 401);

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
		if (!organization)
			throw new AppError("Organization not found for the logged-in user", 404);

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

		res.status(201).json({ cause: await formatResponse(cause) });
	}
);

export const updateCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user)
			throw new AppError("Unauthorized: Authentication required", 401);

		const cause = await Cause.findById(req.params.id);
		if (!cause) throw new AppError("Cause not found", 404);

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
						finalAcceptedDonationTypes = [
							"MONEY",
							...finalAcceptedDonationTypes,
						];
					}
				}
			}
		}

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

		res.status(200).json({ cause: await formatResponse(cause) });
	}
);

export const deleteCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user)
			throw new AppError("Unauthorized: Authentication required", 401);

		const cause = await Cause.findById(req.params.id);
		if (!cause) throw new AppError("Cause not found", 404);

		const organization = await Organization.findOne({ userId: req.user._id });
		if (!organization)
			throw new AppError("Organization not found for the logged-in user", 404);

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

		const formattedCauses = await Promise.all(
			causes.map((cause) => formatResponse(cause))
		);

		res.status(200).json({ causes: formattedCauses, total, page, limit });
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

			const formattedCauses = await Promise.all(
				causes.map((cause) => formatResponse(cause))
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

export const getOrganizationUserIdByCauseId = catchAsync(
	async (req: Request, res: Response) => {
		const { causeId } = req.params;
		if (!causeId) throw new AppError("Cause ID is required", 400);

		const cause = await Cause.findById(causeId).populate(
			"organizationId",
			"name userId email"
		);
		if (!cause) throw new AppError("Cause not found", 404);

		const organization = cause.organizationId as any;
		if (!organization)
			throw new AppError("Organization not found for this cause", 404);
		if (!organization.userId)
			throw new AppError("Organization User ID not found", 404);

		res.status(200).json({
			success: true,
			data: {
				causeId: cause._id.toString(),
				causeTitle: cause.title,
				organizationId: organization._id.toString(),
				organizationName: organization.name,
				organizationUserId: organization.userId.toString(),
				organizationEmail: organization.email,
			},
		});
	}
);
