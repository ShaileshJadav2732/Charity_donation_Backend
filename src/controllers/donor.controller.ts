import { Request, Response } from "express";
import Donor from "../models/donor.model";
import User from "../models/user.model";

// Using the correct interface from firebase-auth controller
interface AuthRequest extends Request {
	user: {
		uid: string;
		dbUser: {
			_id: string;
			email: string;
			role: string;
			displayName?: string;
			photoURL?: string;
		};
	};
}

// Get donor profile
export const getDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user.dbUser._id;

		console.log("Getting donor profile for user ID:", userId);

		const donor = await Donor.findOne({ user: userId }).populate(
			"user",
			"email displayName photoURL"
		);

		if (!donor) {
			console.log("Donor profile not found for user ID:", userId);
			return res.status(404).json({ message: "Donor profile not found" });
		}

		console.log("Found donor profile:", donor);
		return res.status(200).json({ donor });
	} catch (error) {
		console.error("Get donor profile error:", error);
		return res.status(500).json({ message: "Server error" });
	}
};

// Complete donor profile
export const completeDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user.dbUser._id;
		const {
			fullAddress,
			phone,
			profilePhoto,
			donationPreferences,
			availability,
		} = req.body;

		console.log("Complete profile request:", {
			userId,
			fullAddress,
			phone,
			donationPreferences,
			availability,
		});

		// Validate required fields
		if (!fullAddress || !phone || !donationPreferences || !availability) {
			return res.status(400).json({
				message: "Missing required fields",
				received: { fullAddress, phone, donationPreferences, availability },
			});
		}

		if (
			!Array.isArray(donationPreferences) ||
			donationPreferences.length === 0
		) {
			return res.status(400).json({
				message: "Donation preferences must be an array with at least one item",
			});
		}

		// Check if donor already exists
		let donor = await Donor.findOne({ user: userId });

		if (donor) {
			console.log("Updating existing donor profile for user ID:", userId);
			// Update existing donor
			donor.fullAddress = fullAddress;
			donor.phone = phone;
			donor.profilePhoto = profilePhoto;
			donor.donationPreferences = donationPreferences;
			donor.availability = availability;
			donor.isProfileCompleted = true;
		} else {
			console.log("Creating new donor profile for user ID:", userId);
			// Create new donor
			donor = new Donor({
				user: userId,
				fullAddress,
				phone,
				profilePhoto,
				donationPreferences,
				availability,
				isProfileCompleted: true,
			});
		}

		await donor.save();

		// Populate user data
		await donor.populate("user", "email displayName photoURL");

		console.log("Donor profile completed successfully:", donor);
		return res.status(200).json({
			message: "Donor profile completed successfully",
			donor,
			isProfileCompleted: true,
		});
	} catch (error) {
		console.error("Complete donor profile error:", error);
		return res.status(500).json({ message: "Server error" });
	}
};

// Update donor profile
export const updateDonorProfile = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user.dbUser._id;
		const {
			fullAddress,
			phone,
			profilePhoto,
			donationPreferences,
			availability,
		} = req.body;

		const donor = await Donor.findOne({ user: userId });

		if (!donor) {
			return res.status(404).json({ message: "Donor profile not found" });
		}

		// Update fields if provided
		if (fullAddress) donor.fullAddress = fullAddress;
		if (phone) donor.phone = phone;
		if (profilePhoto !== undefined) donor.profilePhoto = profilePhoto;
		if (donationPreferences && Array.isArray(donationPreferences)) {
			donor.donationPreferences = donationPreferences;
		}
		if (availability) donor.availability = availability;

		await donor.save();

		// Populate user data
		await donor.populate("user", "email displayName photoURL");

		return res.status(200).json({
			message: "Donor profile updated successfully",
			donor,
		});
	} catch (error) {
		console.error("Update donor profile error:", error);
		return res.status(500).json({ message: "Server error" });
	}
};
