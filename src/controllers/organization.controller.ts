import { Request, Response } from "express";
import mongoose from "mongoose";
import Organization from "../models/organization.model";
import Cause from "../models/cause.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { AuthRequest } from '../types';


// Helper function to format organization response
const formatOrganizationResponse = (organization: any) => ({
   id: organization._id.toString(),
   name: organization.name,
   description: organization.description,
   phoneNumber: organization.phoneNumber,
   email: organization.email,
   website: organization.website || null,
   address: organization.address || null,
   city: organization.city || null,
   state: organization.state || null,
   country: organization.country || null,
   logo: organization.logo || null,
   verified: organization.verified,
   createdAt: organization.createdAt.toISOString(),
   updatedAt: organization.updatedAt.toISOString(),
});

export const getCurrentOrganization = catchAsync(async (req: AuthRequest, res: Response) => {
   if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
   }

   const userId = req.user.id

   const org = await Organization.findOne({ userId })

   console.log("org", org)


   return res.status(200).json({
      message: 'Organization Profile',
      organization: org,
   });

})

// Get all organizations with pagination and search
export const getOrganizations = catchAsync(async (req: Request, res: Response) => {
   const page = parseInt(req.query.page as string) || 1;
   const limit = parseInt(req.query.limit as string) || 10;
   const search = req.query.search as string;

   const query: any = {};

   if (search) {
      query.$text = { $search: search };
   }

   const skip = (page - 1) * limit;

   const [organizations, total] = await Promise.all([
      Organization.find(query)
         .sort({ createdAt: -1 })
         .skip(skip)
         .limit(limit),
      Organization.countDocuments(query),
   ]);

   res.status(200).json({
      organizations: organizations.map(formatOrganizationResponse),
      total,
      page,
      limit,
   });
});

// Get a single organization by ID
export const getOrganizationById = catchAsync(async (req: Request, res: Response) => {
   const { id } = req.params;

   // Validate object ID
   if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid organization ID format", 400);
   }

   const organization = await Organization.findById(id);

   if (!organization) {
      throw new AppError("Organization not found", 404);
   }

   res.status(200).json({
      organization: formatOrganizationResponse(organization),
   });
});

// Get organization by cause ID
export const getOrganizationByCauseId = catchAsync(async (req: Request, res: Response) => {
   const { causeId } = req.params;

   // Validate object ID
   if (!mongoose.Types.ObjectId.isValid(causeId)) {
      throw new AppError("Invalid cause ID format", 400);
   }

   // First find the cause to get the organization ID
   const cause = await Cause.findById(causeId);

   if (!cause) {
      throw new AppError("Cause not found", 404);
   }

   // Now get the organization
   const organization = await Organization.findById(cause.organizationId);

   if (!organization) {
      // Instead of returning a 404 error, return a placeholder response
      return res.status(200).json({
         organization: {
            id: cause.organizationId.toString(),
            name: "Organization details unavailable",
            description: "This organization's details are not available.",
            phoneNumber: "Not available",
            email: "Not available",
            website: null,
            address: null,
            city: null,
            state: null,
            country: null,
            logo: null,
            verified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         },
      });
   }

   res.status(200).json({
      organization: formatOrganizationResponse(organization),
   });
}); 