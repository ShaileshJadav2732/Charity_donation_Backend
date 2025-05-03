import { Request, Response } from "express";
import { Donation } from "../../models/Donation.model";
import { Donor } from "../../models/Donor.model";
import { IUser } from "../../types/user.types";
import { Organization } from "./../../models/Organization.model";

export const createDonation = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as IUser).id;

		const { type, quantity, pickupAddress, preferredTime, organization } =
			req.body;

		// Validate required fields
		if (
			!type ||
			!quantity ||
			!pickupAddress ||
			!preferredTime ||
			!organization
		) {
			return res.status(400).json({ message: "All fields are required" });
		}

		const donor = await Donor.findOne({ user: userId });
		if (!donor) {
			return res.status(404).json({ message: "Donor profile not found" });
		}

		if (
			!organization ||
			!type ||
			!quantity ||
			!pickupAddress ||
			!preferredTime
		) {
			return res
				.status(400)
				.json({ message: "All required fields must be filled" });
		}

		//  Find organization
		const org = await Organization.findById(organization);
		if (!org) {
			return res.status(404).json({ message: "Organization not found" });
		}

		//Check if donation type is accepted
		if (!org.acceptedDonationTypes.includes(type)) {
			return res.status(400).json({
				message: `This organization does not accept ${type} donations.`,
			});
		}

		// Create a new donation record
		const donation = await Donation.create({
			donor: donor.id,
			organization,
			type,
			quantity,
			pickupAddress,
			preferredTime,
			status: "pending", // Default donation status
		});

		res.status(201).json({
			message: "Donation created successfully",
			donation,
		});
	} catch (error) {
		console.error("Error creating donation:", error);
		res.status(500).json({ message: "Server error" });
	}
};

export const getMyDonations = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as IUser).id; // Comes from auth middleware

		const donor = await Donor.findOne({ user: userId });

		if (!donor) {
			return res.status(404).json({ message: "Donor profile not found" });
		}

		const donorId = donor.id; // Get the donor's ID from the donor document

		const donations = await Donation.find({ donor: donorId })
			.populate("organization", "orgName profilePhoto") // populate basic org info
			.sort({ createdAt: -1 }); // latest first

		res.status(200).json({
			message: "Donations fetched successfully",
			donations,
		});
	} catch (error) {
		console.error("Error fetching donations:", error);
		res.status(500).json({ message: "Server error while fetching donations" });
	}
};

export const getDonationById = async (req: Request, res: Response) => {
	try {
		const donationId = req.params.id;

		const donation = await Donation.findById(donationId)
			.populate("donor", "name email") // assuming User model has name/email
			.populate("organization", "orgName profilePhoto"); // if organization field is in the model

		if (!donation) {
			return res.status(404).json({ message: "Donation not found" });
		}

		res.status(200).json({
			message: "Donation fetched successfully",
			donation,
		});
	} catch (error) {
		console.error("Error fetching donation by ID:", error);
		res.status(500).json({ message: "Server error while fetching donation" });
	}
};

export const getDonationsForOrganization = async (
	req: Request,
	res: Response
) => {
	try {
		const userId = (req.user as IUser).id;

		// Get organization profile based on user ID
		const organization = await Organization.findOne({ user: userId });
		if (!organization) {
			return res
				.status(404)
				.json({ message: "Organization profile not found" });
		}

		// Find donations linked to this organization
		const donations = await Donation.find({ organization: organization._id })
			.populate("donor", "name email") // assuming donor has name/email
			.sort({ createdAt: -1 });

		res.status(200).json({
			message: "Donations for organization fetched successfully",
			donations,
		});
	} catch (error) {
		console.error("Error fetching donations for organization:", error);
		res.status(500).json({ message: "Server error" });
	}
};
export const getDonationsByFilter = async (req: Request, res: Response) => {
	try {
		const { type } = req.query;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const skip = (page - 1) * limit;

		const query: any = {};
		if (type) query.type = type;

		const total = await Donation.countDocuments(query);
		const donations = await Donation.find(query)
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 });

		res.status(200).json({
			message: "Donations fetched successfully",
			donations,
			pagination: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Error fetching donations:", error);
		res.status(500).json({ message: "Server error while fetching donations" });
	}
};
