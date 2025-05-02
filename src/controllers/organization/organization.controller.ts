import { Request, Response } from "express";
import { Organization } from "../../models/Organization.model";
import { IUser } from "../../types";
import { IOrganization } from "../../models/Organization.model";

export const completeOrganizationProfile = async (
	req: Request,
	res: Response
) => {
	try {
		const userId = (req.user as IUser).id;
		const {
			orgName,
			profilePhoto,
			fullAddress,
			phone,
			missionStatement,
			acceptedDonationTypes,
		} = req.body;

		if (
			!orgName ||
			!profilePhoto ||
			!fullAddress ||
			!phone ||
			!missionStatement ||
			!acceptedDonationTypes
		) {
			return res.status(400).json({ message: "All fields are required" });
		}

		const existingOrg = await Organization.findOne({ user: userId });

		let updatedOrg: IOrganization | null;

		if (existingOrg) {
			if (existingOrg.isProfileCompleted) {
				return res.status(400).json({ message: "Profile already completed" });
			}

			existingOrg.orgName = orgName;
			existingOrg.profilePhoto = profilePhoto;
			existingOrg.fullAddress = fullAddress;
			existingOrg.phone = phone;
			existingOrg.missionStatement = missionStatement;
			existingOrg.acceptedDonationTypes = acceptedDonationTypes;
			existingOrg.isProfileCompleted = true;

			updatedOrg = await existingOrg.save();
		} else {
			const newOrg = await Organization.create({
				user: userId,
				orgName,
				profilePhoto,
				fullAddress,
				phone,
				missionStatement,
				acceptedDonationTypes,
				isProfileCompleted: true,
			});

			updatedOrg = newOrg;
		}

		res.status(200).json({
			message: "Organization profile completed",
			organization: updatedOrg,
		});
	} catch (error) {
		console.error("Error completing organization profile:", error);
		res.status(500).json({ message: "Server error" });
	}
};

export const getOrganizationProfile = async (req: Request, res: Response) => {
	try {
		const userId = (req.user as IUser).id;
		const organization = await Organization.findOne({ user: userId }).populate(
			"user"
		);

		if (!organization) {
			return res.status(404).json({ message: "Organization not found" });
		}

		res.status(200).json(organization);
	} catch (error) {
		console.error("Error fetching organization profile:", error);
		res.status(500).json({ message: "Server error" });
	}
};

export const updateOrganizationProfile = async (
	req: Request,
	res: Response
) => {
	try {
		const userId = (req.user as IUser).id;

		const updatedOrg = await Organization.findOneAndUpdate(
			{ user: userId },
			{ ...req.body },
			{ new: true }
		);

		if (!updatedOrg) {
			return res.status(404).json({ message: "Organization not found" });
		}

		res.status(200).json(updatedOrg);
	} catch (error) {
		console.error("Error updating organization profile:", error);
		res.status(500).json({ message: "Server error" });
	}
};
export const getAllOrganizations = async (req: Request, res: Response) => {
	try {
		const organizations = await Organization.find().populate("user");
		res.status(200).json(organizations);
	} catch (error) {
		console.error("Error fetching organizations:", error);
		res.status(500).json({ message: "Server error" });
	}
};
