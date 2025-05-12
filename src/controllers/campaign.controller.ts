import { Request, Response } from "express";
import mongoose from "mongoose";
import Campaign from "../models/campaign.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { IUser } from "../types";

interface AuthRequest extends Request {
   user?: IUser;
}

// Helper function to format campaign response
const formatCampaignResponse = (campaign: any) => ({
   id: campaign._id,
   title: campaign.title,
   description: campaign.description,
   startDate: campaign.startDate,
   endDate: campaign.endDate,
   status: campaign.status,
   causes: campaign.causes,
   organizations: campaign.organizations,
   totalTargetAmount: campaign.totalTargetAmount,
   totalRaisedAmount: campaign.totalRaisedAmount,
   totalSupporters: campaign.totalSupporters,
   imageUrl: campaign.imageUrl,
   tags: campaign.tags,
   createdAt: campaign.createdAt,
   updatedAt: campaign.updatedAt,
});

// Helper function to check organization access
const checkOrganizationAccess = (campaign: any, userId: string | undefined) => {
   if (!userId) return false;
   return campaign.organizations.some((org: mongoose.Types.ObjectId) =>
      org.toString() === userId
   );
};

// Get all campaigns with pagination and filters
export const getCampaigns = catchAsync(async (req: Request, res: Response) => {
   const page = parseInt(req.query.page as string) || 1;
   const limit = parseInt(req.query.limit as string) || 10;
   const status = req.query.status as string;
   const search = req.query.search as string;
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
         .populate("organizations", "name")
         .populate("causes", "title targetAmount raisedAmount"),
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
export const getCampaignById = catchAsync(async (req: Request, res: Response) => {
   const campaign = await Campaign.findById(req.params.id)
      .populate("organizations", "name")
      .populate("causes", "title targetAmount raisedAmount");

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   res.status(200).json({
      campaign: formatCampaignResponse(campaign),
   });
});

// Create a new campaign
export const createCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const campaign = await Campaign.create({
      ...req.body,
      organizations: [req.user._id], // Add the creating organization
   });

   res.status(201).json({
      campaign: formatCampaignResponse(campaign),
   });
});

// Update a campaign
export const updateCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const campaign = await Campaign.findById(req.params.id);

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   // Check if user's organization is part of the campaign
   if (!checkOrganizationAccess(campaign, req.user._id)) {
      throw new AppError("Not authorized to update this campaign", 403);
   }

   const updatedCampaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
   ).populate("organizations", "name")
      .populate("causes", "title targetAmount raisedAmount");

   res.status(200).json({
      campaign: formatCampaignResponse(updatedCampaign!),
   });
});

// Delete a campaign
export const deleteCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const campaign = await Campaign.findById(req.params.id);

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   // Check if user's organization is part of the campaign
   if (!checkOrganizationAccess(campaign, req.user._id)) {
      throw new AppError("Not authorized to delete this campaign", 403);
   }

   await campaign.deleteOne();

   res.status(204).json({
      status: "success",
      data: null,
   });
});

// Add cause to campaign
export const addCauseToCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const { causeId } = req.body;

   const campaign = await Campaign.findById(req.params.id);

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   // Check if user's organization is part of the campaign
   if (!checkOrganizationAccess(campaign, req.user._id)) {
      throw new AppError("Not authorized to modify this campaign", 403);
   }

   // Add cause if not already present
   if (!campaign.causes.includes(causeId)) {
      campaign.causes.push(causeId);
      await campaign.save();
   }

   const updatedCampaign = await Campaign.findById(req.params.id)
      .populate("organizations", "name")
      .populate("causes", "title targetAmount raisedAmount");

   res.status(200).json({
      campaign: formatCampaignResponse(updatedCampaign!),
   });
});

// Remove cause from campaign
export const removeCauseFromCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const { causeId } = req.params;

   const campaign = await Campaign.findById(req.params.id);

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   // Check if user's organization is part of the campaign
   if (!checkOrganizationAccess(campaign, req.user._id)) {
      throw new AppError("Not authorized to modify this campaign", 403);
   }

   // Remove cause
   campaign.causes = campaign.causes.filter(
      (cause) => cause.toString() !== causeId
   );
   await campaign.save();

   const updatedCampaign = await Campaign.findById(req.params.id)
      .populate("organizations", "name")
      .populate("causes", "title targetAmount raisedAmount");

   res.status(200).json({
      campaign: formatCampaignResponse(updatedCampaign!),
   });
});

// Add organization to campaign
export const addOrganizationToCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const { organizationId } = req.body;

   const campaign = await Campaign.findById(req.params.id);

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   // Check if user's organization is part of the campaign
   if (!checkOrganizationAccess(campaign, req.user._id)) {
      throw new AppError("Not authorized to modify this campaign", 403);
   }

   // Add organization if not already present
   if (!campaign.organizations.includes(organizationId)) {
      campaign.organizations.push(organizationId);
      await campaign.save();
   }

   const updatedCampaign = await Campaign.findById(req.params.id)
      .populate("organizations", "name")
      .populate("causes", "title targetAmount raisedAmount");

   res.status(200).json({
      campaign: formatCampaignResponse(updatedCampaign!),
   });
});

// Remove organization from campaign
export const removeOrganizationFromCampaign = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      throw new AppError("Unauthorized", 401);
   }

   const { organizationId } = req.params;

   const campaign = await Campaign.findById(req.params.id);

   if (!campaign) {
      throw new AppError("Campaign not found", 404);
   }

   // Check if user's organization is part of the campaign
   if (!checkOrganizationAccess(campaign, req.user._id)) {
      throw new AppError("Not authorized to modify this campaign", 403);
   }

   // Remove organization
   campaign.organizations = campaign.organizations.filter(
      (org) => org.toString() !== organizationId
   );
   await campaign.save();

   const updatedCampaign = await Campaign.findById(req.params.id)
      .populate("organizations", "name")
      .populate("causes", "title targetAmount raisedAmount");

   res.status(200).json({
      campaign: formatCampaignResponse(updatedCampaign!),
   });
}); 