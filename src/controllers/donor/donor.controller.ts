import { Request, Response } from "express";
import { Donor } from "../../models/Donor.model";
import { IUser, IDonor } from "../../types";

export const completeDonorProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser).id;

    const {
      profilePhoto,
      fullAddress,
      phone,
      donationPreferences,
      availability,
    } = req.body;

    if (
      !profilePhoto ||
      !fullAddress ||
      !phone ||
      !donationPreferences ||
      !availability
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingDonor = await Donor.findOne({ user: userId });

    let updatedDonor: IDonor | null;

    if (existingDonor) {
      if (existingDonor.isProfileCompleted) {
        return res.status(400).json({ message: "Profile already completed" });
      }

      existingDonor.profilePhoto = profilePhoto;
      existingDonor.fullAddress = fullAddress;
      existingDonor.phone = phone;
      existingDonor.donationPreferences = donationPreferences;
      existingDonor.availability = availability;
      existingDonor.isProfileCompleted = true;

      updatedDonor = (await existingDonor.save()).toObject();
    } else {
      const createdDonor = await Donor.create({
        user: userId,
        profilePhoto,
        fullAddress,
        phone,
        donationPreferences,
        availability,
        isProfileCompleted: true,
      });

      updatedDonor = createdDonor.toObject() as IDonor;
    }

    res.status(200).json({
      message: "Profile completed successfully",
      donor: updatedDonor,
    });
  } catch (error) {
    console.error("Error completing donor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};
export const getDonorProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser).id;

    const donor = await Donor.findOne({ user: userId }).populate("user");

    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }

    res.status(200).json(donor);
  } catch (error) {
    console.error("Error fetching donor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateDonorProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser).id;

    const donor = await Donor.findOneAndUpdate(
      { user: userId },
      { ...req.body },
      { new: true }
    );

    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }

    res.status(200).json(donor);
  } catch (error) {
    console.error("Error updating donor profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};
