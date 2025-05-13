import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import { AuthRequest } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";

import asyncHandler from "express-async-handler";

const generateToken = (email: string) => {
  return jwt.sign({ email }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, name, firebaseUid } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Create new user without password (since auth is handled by Firebase)
  const user = await User.create({
    email,
    name,
    firebaseUid,
    password: undefined, // No password stored in MongoDB
  });

  // Generate JWT token for your backend API
  const token = generateToken(user.email);

  console.log("tokenn", token);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    message: "User registered successfully",
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      firebaseUid: user.firebaseUid,
    },
  });
});

export const checkUserExists = asyncHandler(async (req, res) => {
  const { email } = req.query;

  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.status(200).json({ exists: true, user });
});

export const logout = (req: Request, res: Response): void => {
  res
    .cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    })
    .status(200)
    .json({ message: "Logged out successfully" });
};

// Get current user profile
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
