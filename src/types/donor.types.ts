import { Document } from "mongoose";

export interface IDonor extends Document {
  id: string;
  user: string;
  profilePhoto: string;
  fullAddress: string;
  phone: string;
  donationPreferences: string[];
  availability: string;
  isProfileCompleted: boolean;
  totalDonations?: number;
  donationHistory?: string[];
  createdAt: Date;
  updatedAt: Date;
  toObject(): any;
}
