import { Request, Response } from "express";
import mongoose from "mongoose";
import Organization from "../models/organization.model";
import Cause from "../models/cause.model";
import Donation from "../models/donation.model";
import User from "../models/user.model";
import DonorProfile from "../models/donor.model";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";
import { AuthRequest } from "../types";
import { DonationStatus, DonationType } from "../models/donation.model";

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

export const getCurrentOrganization = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const userId = req.user.id;

		const org = await Organization.findOne({ userId });

		console.log("org", org);

		return res.status(200).json({
			message: "Organization Profile",
			organization: org,
		});
	}
);

// Get all organizations with pagination and search
export const getOrganizations = catchAsync(
	async (req: Request, res: Response) => {
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;

		const query: any = {};

		if (search) {
			query.$text = { $search: search };
		}

		const skip = (page - 1) * limit;

		const [organizations, total] = await Promise.all([
			Organization.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
			Organization.countDocuments(query),
		]);

		res.status(200).json({
			organizations: organizations.map(formatOrganizationResponse),
			total,
			page,
			limit,
		});
	}
);

// Get a single organization by ID
export const getOrganizationById = catchAsync(
	async (req: Request, res: Response) => {
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
	}
);

// Get organization by cause ID
export const getOrganizationByCauseId = catchAsync(
	async (req: Request, res: Response) => {
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
	}
);

// Get donors for an organization
export const getOrganizationDonors = catchAsync(
	async (req: AuthRequest, res: Response) => {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		const userId = req.user.id;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const search = req.query.search as string;

		// Find the organization profile for this user
		const organization = await Organization.findOne({ userId });

		if (!organization) {
			return res.status(404).json({
				success: false,
				message: "Organization profile not found",
			});
		}

		const organizationId = organization._id;

		// Build aggregation pipeline to get donors with their stats
		const matchStage: any = {
			organization: new mongoose.Types.ObjectId(organizationId),
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] },
		};

		// Get unique donors with their donation stats
		const donorsAggregation = await Donation.aggregate([
			{ $match: matchStage },
			{
				$group: {
					_id: "$donor",
					totalDonated: {
						$sum: {
							$cond: [{ $eq: ["$type", DonationType.MONEY] }, "$amount", 0],
						},
					},
					totalDonations: { $sum: 1 },
					lastDonation: { $max: "$createdAt" },
					firstDonation: { $min: "$createdAt" },
					donationTypes: { $addToSet: "$type" },
					causes: { $addToSet: "$cause" },
				},
			},
			{
				$lookup: {
					from: "users",
					localField: "_id",
					foreignField: "_id",
					as: "userInfo",
				},
			},
			{
				$lookup: {
					from: "donorprofiles",
					localField: "_id",
					foreignField: "userId",
					as: "donorProfile",
				},
			},
			{
				$unwind: {
					path: "$userInfo",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$unwind: {
					path: "$donorProfile",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$addFields: {
					donorName: {
						$cond: {
							if: {
								$and: ["$donorProfile.firstName", "$donorProfile.lastName"],
							},
							then: {
								$concat: [
									"$donorProfile.firstName",
									" ",
									"$donorProfile.lastName",
								],
							},
							else: "$userInfo.email",
						},
					},
					email: "$userInfo.email",
					phoneNumber: "$donorProfile.phoneNumber",
					address: "$donorProfile.address",
					city: "$donorProfile.city",
					state: "$donorProfile.state",
					country: "$donorProfile.country",
					profileImage: "$donorProfile.profileImage",
					// Calculate frequency based on donation count and time span
					frequency: {
						$cond: {
							if: { $gte: ["$totalDonations", 12] },
							then: "Regular",
							else: {
								$cond: {
									if: { $gte: ["$totalDonations", 5] },
									then: "Frequent",
									else: "Occasional",
								},
							},
						},
					},
					// Calculate impact score based on total donated and frequency
					impactScore: {
						$min: [
							100,
							{
								$add: [
									{ $multiply: [{ $divide: ["$totalDonated", 100] }, 0.7] },
									{ $multiply: ["$totalDonations", 2] },
								],
							},
						],
					},
				},
			},
		]);

		// Apply search filter if provided
		let filteredDonors = donorsAggregation;
		if (search) {
			const searchRegex = new RegExp(search, "i");
			filteredDonors = donorsAggregation.filter(
				(donor) =>
					searchRegex.test(donor.donorName) || searchRegex.test(donor.email)
			);
		}

		// Apply pagination
		const total = filteredDonors.length;
		const skip = (page - 1) * limit;
		const paginatedDonors = filteredDonors.slice(skip, skip + limit);

		// Format the response
		const formattedDonors = paginatedDonors.map((donor) => ({
			id: donor._id.toString(),
			name: donor.donorName,
			email: donor.email,
			phoneNumber: donor.phoneNumber || null,
			address: {
				street: donor.address || null,
				city: donor.city || null,
				state: donor.state || null,
				country: donor.country || null,
			},
			profileImage: donor.profileImage || null,
			totalDonated: Math.round(donor.totalDonated * 100) / 100,
			totalDonations: donor.totalDonations,
			lastDonation: donor.lastDonation,
			firstDonation: donor.firstDonation,
			frequency: donor.frequency,
			impactScore: Math.round(donor.impactScore),
			donationTypes: donor.donationTypes,
			causesSupported: donor.causes.length,
		}));

		// Calculate summary stats
		const totalDonors = total;
		const totalFundsRaised = donorsAggregation.reduce(
			(sum, donor) => sum + donor.totalDonated,
			0
		);
		const averageDonation =
			totalFundsRaised /
				donorsAggregation.reduce(
					(sum, donor) => sum + donor.totalDonations,
					0
				) || 0;

		res.status(200).json({
			success: true,
			data: {
				donors: formattedDonors,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
				summary: {
					totalDonors,
					totalFundsRaised: Math.round(totalFundsRaised * 100) / 100,
					averageDonation: Math.round(averageDonation * 100) / 100,
				},
			},
		});
	}
);
