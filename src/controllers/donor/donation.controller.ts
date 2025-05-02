import { Request, Response } from "express";
import { Donation } from "../../models/Donation.model";
import { IUser } from "../../types/user.types";

export const createDonation = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as IUser).id;

    const { type, quantity, pickupAddress, preferredTime } = req.body;
   
    // Validate required fields
    if (!type || !quantity || !pickupAddress || !preferredTime) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Handling different donation types and quantity validation
    switch (type.toLowerCase()) {
      case "blood":
        // For blood, ensure quantity is in "unit(s)"
        if (!quantity.toLowerCase().includes("unit")) {
          return res
            .status(400)
            .json({ message: "Blood quantity must be in 'unit(s)'" });
        }
        break;

      case "clothes":
        // For clothes, ensure quantity is in "bag(s)"
        if (!quantity.toLowerCase().includes("bag")) {
          return res
            .status(400)
            .json({ message: "Clothes quantity must be in 'bag(s)'" });
        }
        break;

      case "food":
        // For food, ensure quantity is in "packet(s)"
        if (!quantity.toLowerCase().includes("packet")) {
          return res
            .status(400)
            .json({ message: "Food quantity must be in 'packet(s)'" });
        }
        break;

      case "money":
        // For money, it should be a numerical value
        const moneyAmount = parseInt(quantity);
        if (isNaN(moneyAmount) || moneyAmount <= 0) {
          return res
            .status(400)
            .json({ message: "Money quantity must be a positive number" });
        }
        break;

      case "books":
        // For books, ensure quantity is in "book(s)"
        if (!quantity.toLowerCase().includes("book")) {
          return res
            .status(400)
            .json({ message: "Books quantity must be in 'book(s)'" });
        }
        break;

      default:
        return res.status(400).json({ message: "Invalid donation type" });
    }

    // Create a new donation record
    const donation = await Donation.create({
      user: userId,
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
