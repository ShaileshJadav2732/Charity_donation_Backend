import { Request, Response } from "express";
import { Donor } from "../../models/Donor.model";
import { IUser } from "../../types";
export const getDonorProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(400).json({ message: "User information is missing" });
    }
  const donor = await Donor.findOne({ user: req.user?.id as string }).populate(
    "user"
  );
    if (!donor) return res.status(404).json({ message: "Donor not found" });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateDonorProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {  
      return res.status(400).json({ message: "User information is missing" });
    }
    const donor = await Donor.findOneAndUpdate(
      { user: (req.user as IUser).id },
      { ...req.body },
      { new: true }
    );
    if (!donor) return res.status(404).json({ message: "Donor not found" });
    res.json(donor);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
