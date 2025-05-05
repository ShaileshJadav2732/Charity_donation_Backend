import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import Donation from "../models/donation.model";
import Organization from "../models/organization.model";
import Donor from "../models/donor.model";
import mongoose from "mongoose";

// Create a new donation request
export const createDonation = async (req: AuthRequest, res: Response) => {
	try {
		const {
			organization,
			type,
			quantity,
			pickupAddress,
			preferredTime,
			notes,
		} = req.body;

		// Validate required fields
		if (
			!organization ||
			!type ||
			!quantity ||
			!pickupAddress ||
			!preferredTime
		) {
			return res.status(400).json({ message: "Required fields missing" });
		}

		// Check if donor profile is complete
		const donor = await Donor.findOne({ user: req.user._id });

		if (!donor || !donor.isProfileCompleted) {
			return res
				.status(400)
				.json({ message: "Please complete your donor profile first" });
		}

		// Check if organization exists
		const orgExists = await Organization.findById(organization);

		if (!orgExists) {
			return res.status(404).json({ message: "Organization not found" });
		}

		// Create donation request
		const donation = await Donation.create({
			donor: req.user._id,
			organization,
			type,
			quantity,
			pickupAddress,
			preferredTime,
			notes,
			status: "pending",
		});

		res.status(201).json({
			message: "Donation request created successfully",
			donation,
		});
	} catch (error) {
		console.error("Create donation error:", error);
		res.status(500).json({ message: "Failed to create donation request" });
	}
};

// Get donor's donations
export const getDonorDonations = async (req: AuthRequest, res: Response) => {
	try {
		const donations = await Donation.find({ donor: req.user._id })
			.populate({
				path: "organization",
				select: "orgName profilePhoto",
			})
			.sort({ createdAt: -1 });

		res.status(200).json({
			message: "Donations retrieved successfully",
			donations,
		});
	} catch (error) {
		console.error("Get donor donations error:", error);
		res.status(500).json({ message: "Failed to retrieve donations" });
	}
};

// Get organization's donations
export const getOrganizationDonations = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		// Find the organization associated with the user
		const organization = await Organization.findOne({ user: req.user._id });

		if (!organization) {
			return res
				.status(404)
				.json({ message: "Organization profile not found" });
		}

		const donations = await Donation.find({ organization: organization._id })
			.populate({
				path: "donor",
				select: "username displayName photoURL",
			})
			.sort({ createdAt: -1 });

		res.status(200).json({
			message: "Donations retrieved successfully",
			donations,
		});
	} catch (error) {
		console.error("Get organization donations error:", error);
		res.status(500).json({ message: "Failed to retrieve donations" });
	}
};

// Get donation by ID
export const getDonationById = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		const donation = await Donation.findById(id)
			.populate({
				path: "organization",
				select: "orgName profilePhoto contactEmail contactPhone address",
			})
			.populate({
				path: "donor",
				select: "username displayName photoURL",
			});

		if (!donation) {
			return res.status(404).json({ message: "Donation not found" });
		}

		// Check if the user is the donor or from the organization
		const isAuthorized =
			donation.donor._id.toString() === req.user._id.toString() ||
			(await Organization.exists({
				user: req.user._id,
				_id: donation.organization._id,
			}));

		if (!isAuthorized) {
			return res
				.status(403)
				.json({ message: "Not authorized to view this donation" });
		}

		res.status(200).json({
			message: "Donation retrieved successfully",
			donation,
		});
	} catch (error) {
		console.error("Get donation by ID error:", error);
		res.status(500).json({ message: "Failed to retrieve donation" });
	}
};

// Update donation status (Organization only)
export const updateDonationStatus = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		// Validate status
		const validStatuses = [
			"pending",
			"accepted",
			"rejected",
			"completed",
			"cancelled",
		];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({ message: "Invalid status" });
		}

		// Find donation
		const donation = await Donation.findById(id);

		if (!donation) {
			return res.status(404).json({ message: "Donation not found" });
		}

		// Verify that the user is from the organization that received this donation
		const organization = await Organization.findOne({ user: req.user._id });

		if (
			!organization ||
			organization._id.toString() !== donation.organization.toString()
		) {
			return res
				.status(403)
				.json({ message: "Not authorized to update this donation" });
		}

		// Update status
		donation.status = status;
		await donation.save();

		res.status(200).json({
			message: "Donation status updated successfully",
			donation,
		});
	} catch (error) {
		console.error("Update donation status error:", error);
		res.status(500).json({ message: "Failed to update donation status" });
	}
};

// Cancel donation (Donor only)
export const cancelDonation = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;

		// Find donation
		const donation = await Donation.findById(id);

		if (!donation) {
			return res.status(404).json({ message: "Donation not found" });
		}

		// Verify that the user is the donor who created this donation
		if (donation.donor.toString() !== req.user._id.toString()) {
			return res
				.status(403)
				.json({ message: "Not authorized to cancel this donation" });
		}

		// Only pending donations can be cancelled
		if (donation.status !== "pending") {
			return res
				.status(400)
				.json({ message: "Only pending donations can be cancelled" });
		}

		// Update status to cancelled
		donation.status = "cancelled";
		await donation.save();

		res.status(200).json({
			message: "Donation cancelled successfully",
			donation,
		});
	} catch (error) {
		console.error("Cancel donation error:", error);
		res.status(500).json({ message: "Failed to cancel donation" });
	}
};
