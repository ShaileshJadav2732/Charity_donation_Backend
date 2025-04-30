// middlewares/checkDonorProfile.ts
import { Request, Response, NextFunction } from "express";
import { Donor } from "../models/Donor.model";

export const checkDonorProfileComplete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const donor = await Donor.findOne({ user: req.user?.id });
  if (!donor || !donor.isProfileCompleted) {
    return res.status(400).json({
      message: "Please complete your donor profile first",
    });
  }
  next();
};
