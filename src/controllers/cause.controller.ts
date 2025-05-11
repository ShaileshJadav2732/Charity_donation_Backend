import { Request, Response } from "express";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import Organization from "../models/organization.model";
import { IUser } from "../types";

interface AuthRequest extends Request {
   user?: IUser;
}

// Helper function to format cause response
const formatCauseResponse = (cause: any) => ({
   id: cause._id,
   title: cause.title,
   description: cause.description,
   category: cause.category,
   targetAmount: cause.targetAmount,
   raisedAmount: cause.raisedAmount,
   supporters: cause.supporters,
   imageUrl: cause.imageUrl,
   organizationId: cause.organizationId,
   status: cause.status,
   createdAt: cause.createdAt,
   updatedAt: cause.updatedAt,
});

// Get all causes with pagination and filters
export const getCauses = catchAsync(async (req: Request, res: Response) => {
   const page = parseInt(req.query.page as string) || 1;
   const limit = parseInt(req.query.limit as string) || 10;
   const category = req.query.category as string;
   const search = req.query.search as string;

   const query: any = { status: "active" };

   if (category && category !== "all") {
      query.category = category;
   }

   if (search) {
      query.$text = { $search: search };
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
   const cause = await Cause.findById(req.params.id).populate("organizationId", "name");

   if (!cause) {
      throw new AppError("Cause not found", 404);
   }

   res.status(200).json({
      cause: formatCauseResponse(cause),
   });
});

// Create a new cause (organization only)
export const createCause = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const organization = await Organization.findOne({ userId: req.user._id });

   if (!organization) {
      throw new AppError("Organization not found", 404);
   }

   const cause = await Cause.create({
      ...req.body,
      organizationId: organization._id,
   });

   res.status(201).json({
      cause: formatCauseResponse(cause),
   });
});

// Update a cause (organization only)
export const updateCause = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const cause = await Cause.findById(req.params.id);

   if (!cause) {
      throw new AppError("Cause not found", 404);
   }

   const organization = await Organization.findOne({ userId: req.user._id });

   if (!organization || cause.organizationId.toString() !== organization._id.toString()) {
      throw new AppError("Not authorized to update this cause", 403);
   }

   const updatedCause = await Cause.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
   );

   res.status(200).json({
      cause: formatCauseResponse(updatedCause!),
   });
});

// Delete a cause (organization only)
export const deleteCause = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const cause = await Cause.findById(req.params.id);

   if (!cause) {
      throw new AppError("Cause not found", 404);
   }

   const organization = await Organization.findOne({ userId: req.user._id });

   if (!organization || cause.organizationId.toString() !== organization._id.toString()) {
      throw new AppError("Not authorized to delete this cause", 403);
   }

   await cause.deleteOne();

   res.status(204).json({
      status: "success",
      data: null,
   });
});

// Get causes by organization
export const getOrganizationCauses = catchAsync(async (req: Request, res: Response) => {
   const page = parseInt(req.query.page as string) || 1;
   const limit = parseInt(req.query.limit as string) || 10;
   const organizationId = req.params.organizationId;

   const skip = (page - 1) * limit;

   const [causes, total] = await Promise.all([
      Cause.find({ organizationId })
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limit),
      Cause.countDocuments({ organizationId }),
   ]);

   res.status(200).json({
      causes: causes.map(formatCauseResponse),
      total,
      page,
      limit,
   });
});

// Get causes by donor (causes they've supported)
export const getDonorCauses = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const page = parseInt(req.query.page as string) || 1;
   const limit = parseInt(req.query.limit as string) || 10;
   const donorId = req.user._id;

   const skip = (page - 1) * limit;

   // Get all donations by the donor
   const donations = await Donation.find({ donorId }).distinct("causeId");

   const [causes, total] = await Promise.all([
      Cause.find({ _id: { $in: donations } })
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limit)
         .populate("organizationId", "name"),
      Cause.countDocuments({ _id: { $in: donations } }),
   ]);

   res.status(200).json({
      causes: causes.map(formatCauseResponse),
      total,
      page,
      limit,
   });
}); 