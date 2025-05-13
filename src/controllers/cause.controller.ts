import { Request, Response } from "express";
import mongoose from "mongoose";
import Cause, { ICause } from "../models/cause.model";
import Donation from "../models/donation.model";
import Campaign from "../models/campaign.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";
import { validateObjectId } from "../utils/validation";

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
export const getCauseById = catchAsync(async (req: Request, res: Response) => {
	const cause = await Cause.findById(req.params.id).populate(
		"organizationId",
		"name"
	);

	if (!cause) {
		throw new AppError("Cause not found", 404);
	}

	res.status(200).json({
		cause: formatCauseResponse(cause),
	});
});

// Create a new cause (organization only)
export const createCause = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			throw new AppError("Unauthorized: Authentication required", 401);
		}

		const { title, description, targetAmount, imageUrl, tags } = req.body;

		// Validate required fields
		if (!title || !description || targetAmount === undefined || !imageUrl) {
			throw new AppError("Missing required fields", 400);
		}

		// Validate targetAmount
		if (targetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
		}

		const cause = await Cause.create({
			title,
			description,
			targetAmount,
			imageUrl,
			tags: tags || [],
			organizationId: req.user._id,
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

		const cause = await Cause.findById(req.params.id);

		if (!cause) {
			throw new AppError("Cause not found", 404);
		}

		// Check if user's organization owns the cause
		if (!cause.organizationId.equals(req.user._id)) {
			throw new AppError(
				"Unauthorized: You do not have permission to update this cause",
				403
			);
		}

		const { title, description, targetAmount, imageUrl, tags } = req.body;

		// Validate targetAmount if provided
		if (targetAmount !== undefined && targetAmount <= 0) {
			throw new AppError("Target amount must be greater than 0", 400);
		}

		// Update fields
		cause.set({
			title: title || cause.title,
			description: description || cause.description,
			targetAmount:
				targetAmount !== undefined ? targetAmount : cause.targetAmount,
			imageUrl: imageUrl || cause.imageUrl,
			tags: tags || cause.tags,
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

		// Check if user's organization owns the cause
		if (!cause.organizationId.equals(req.user._id)) {
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

// Get cause details with campaign and donation statistics
export const getCauseDetails = catchAsync(
	async (req: Request, res: Response) => {
		try {
			const { causeId } = req.params;

			if (!validateObjectId(causeId)) {
				return res.status(400).json({ message: "Invalid cause ID" });
			}

			const cause = await Cause.findById(causeId).populate(
				"organizationId",
				"name email phone address"
			);

			if (!cause) {
				return res.status(404).json({ message: "Cause not found" });
			}

			// Get associated campaigns
			const campaigns = await Campaign.find({ causes: causeId })
				.select("title description status totalTargetAmount totalRaisedAmount")
				.populate("organizations", "name");

			// Get donation statistics
			const donationStats = await Donation.aggregate([
				{
					$match: {
						cause: cause._id,
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

			// Calculate progress
			const progress = {
				percentage: (cause.raisedAmount / cause.targetAmount) * 100,
				remaining: cause.targetAmount - cause.raisedAmount,
			};

			res.status(200).json({
				success: true,
				data: {
					cause,
					campaigns,
					donationStats,
					progress,
				},
			});
		} catch (error: any) {
			res.status(500).json({
				success: false,
				message: "Error fetching cause details",
				error: error?.message || "Unknown error occurred",
			});
		}
	}
);
