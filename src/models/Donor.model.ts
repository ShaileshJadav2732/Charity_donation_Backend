// models/Donor.ts
import mongoose from "mongoose";

const donorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    address: String,
    phone: String,
    donations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Donation",
      },
    ],
  },
  { timestamps: true }
);

export const Donor = mongoose.model("Donor", donorSchema);
