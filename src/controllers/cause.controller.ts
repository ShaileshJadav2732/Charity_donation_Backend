import { Request, Response } from "express";
import mongoose from "mongoose";
import { Cause } from "../models/cause.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser, AuthRequest } from "../types/interfaces";
import { uploadToCloudinary } from "../utils/cloudinary";
import { CauseCategory } from "../types/enums";

// Get all causes with pagination and filters
export const getCauses = catchAsync(async (req: Request, res: Response) => {
	const { category, organization, search, page = 1, limit = 10 } = req.query;
	const query: any = {};

	if (category) query.category = category;
	if (organization) query.organization = organization;
	if (search) {
		query.$or = [
			{ title: { $regex: search, $options: "i" } },
			{ description: { $regex: search, $options: "i" } }
		];
	}

	const causes = await Cause.find(query)
		.populate("organization", "name")
		.sort({ createdAt: -1 })
		.skip((Number(page) - 1) * Number(limit))
		.limit(Number(limit));

	const total = await Cause.countDocuments(query);

	res.status(200).json({
		success: true,
		data: {
			causes,
			total,
			page: Number(page),
			limit: Number(limit),
			totalPages: Math.ceil(total / Number(limit))
		}
	});
});

// Get a single cause by ID
export const getCauseById = catchAsync(async (req: Request, res: Response) => {
	const cause = await Cause.findById(req.params.id).populate("organization", "name");

	if (!cause) {
		throw new AppError("Cause not found", 404);
	}

	res.status(200).json({
		success: true,
		data: cause
	});
});

// Create a new cause
export const createCause = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user) {
		throw new AppError("Not authenticated", 401);
	}

	const { title, description, category } = req.body;
	const imageFile = req.file;

	if (!title || !description || !category) {
		throw new AppError("Please provide title, description, and category", 400);
	}

	let image;
	if (imageFile) {
		const uploadResult = await uploadToCloudinary(imageFile, "causes");
		image = uploadResult.secure_url;
	}

	const cause = await Cause.create({
		title,
		description,
		category,
		image,
		organization: req.user._id,
		campaigns: []
	});

	res.status(201).json({
		success: true,
		data: cause
	});
});

// Update a cause
export const updateCause = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user) {
		throw new AppError("Not authenticated", 401);
	}

	const cause = await Cause.findById(req.params.id);

	if (!cause) {
		throw new AppError("Cause not found", 404);
	}

	if (cause.organization.toString() !== req.user._id.toString()) {
		throw new AppError("Not authorized to update this cause", 403);
	}

	const { title, description, category } = req.body;
	const imageFile = req.file;

	let image = cause.image;
	if (imageFile) {
		const uploadResult = await uploadToCloudinary(imageFile, "causes");
		image = uploadResult.secure_url;
	}

	const updatedCause = await Cause.findByIdAndUpdate(
		req.params.id,
		{
			title: title || cause.title,
			description: description || cause.description,
			category: category || cause.category,
			image
		},
		{ new: true }
	).populate("organization", "name");

	res.status(200).json({
		success: true,
		data: updatedCause
	});
});

// Delete a cause
export const deleteCause = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user) {
		throw new AppError("Not authenticated", 401);
	}

	const cause = await Cause.findById(req.params.id);

	if (!cause) {
		throw new AppError("Cause not found", 404);
	}

	if (cause.organization.toString() !== req.user._id.toString()) {
		throw new AppError("Not authorized to delete this cause", 403);
	}

	await cause.deleteOne();

	res.status(200).json({
		success: true,
		data: {}
	});
});

// Get causes for an organization
export const getOrganizationCauses = catchAsync(async (req: AuthRequest, res: Response) => {
	if (!req.user) {
		throw new AppError("Not authenticated", 401);
	}

	const { page = 1, limit = 10, search } = req.query;
	const query: any = { organization: req.user._id };

	if (search) {
		query.$or = [
			{ title: { $regex: search, $options: "i" } },
			{ description: { $regex: search, $options: "i" } }
		];
	}

	const causes = await Cause.find(query)
		.populate("organization", "name")
		.sort({ createdAt: -1 })
		.skip((Number(page) - 1) * Number(limit))
		.limit(Number(limit));

	const total = await Cause.countDocuments(query);

	res.status(200).json({
		success: true,
		data: {
			causes,
			total,
			page: Number(page),
			limit: Number(limit),
			totalPages: Math.ceil(total / Number(limit))
		}
	});
});
