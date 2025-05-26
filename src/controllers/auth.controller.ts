import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import admin from "../config/firebase.config";
import User from "../models/user.model";
import { AuthRequest } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";

if (!JWT_SECRET) {
	throw new Error("JWT_SECRET is required");
}

// Register a new user
export const register = async (req: Request, res: Response) => {
	try {
		console.log("Register request body:", req.body);
		const { email, firebaseUid, role } = req.body;

		// Validate input
		if (!email || !firebaseUid || !role) {
			console.log("Missing required fields:", { email, firebaseUid, role });
			return res
				.status(400)
				.json({ message: "Email, firebaseUid, and role are required" });
		}

		// Check if user already exists by email
		const existingUserByEmail = await User.findOne({ email });
		if (existingUserByEmail) {
			console.log("User already exists with email:", email);
			return res
				.status(400)
				.json({ message: "User already exists with this email" });
		}

		// Check if user already exists by firebaseUid
		const existingUserByUid = await User.findOne({ firebaseUid });
		if (existingUserByUid) {
			console.log("User already exists with firebaseUid:", firebaseUid);
			return res
				.status(400)
				.json({ message: "User already exists with this Firebase ID" });
		}

		// Create new user
		const newUser = new User({
			email,
			firebaseUid,
			role,
			profileCompleted: false,
		});

		console.log("Creating new user:", newUser);
		await newUser.save();
		console.log("User saved successfully with ID:", newUser._id);

		// Generate JWT token
		const token = jwt.sign(
			{ id: newUser._id, email: newUser.email, role: newUser.role },
			JWT_SECRET as string,
			{ expiresIn: JWT_EXPIRATION as string }
		);

		return res.status(201).json({
			message: "User registered successfully",
			user: {
				id: newUser._id,
				email: newUser.email,
				role: newUser.role,
				profileCompleted: newUser.profileCompleted,
			},
			token,
		});
	} catch (error) {
		console.error("Registration error:", error);
		return res
			.status(500)
			.json({ message: "Server error during registration" });
	}
};

// Login user
export const login = async (req: Request, res: Response) => {
	try {
		console.log("Login request body:", req.body);
		const { firebaseUid } = req.body;

		if (!firebaseUid) {
			console.log("Missing firebaseUid in login request");
			return res.status(400).json({ message: "Firebase UID is required" });
		}

		// Find user by Firebase UID
		console.log("Looking for user with firebaseUid:", firebaseUid);
		const user = await User.findOne({ firebaseUid });

		if (!user) {
			console.log("User not found with firebaseUid:", firebaseUid);
			return res.status(404).json({ message: "User not found" });
		}

		console.log("User found:", user);

		// Generate JWT token
		const token = jwt.sign(
			{ id: user._id, email: user.email, role: user.role },
			JWT_SECRET as string,
			{ expiresIn: JWT_EXPIRATION as string }
		);

		return res.status(200).json({
			message: "Login successful",
			user: {
				id: user._id,
				email: user.email,
				role: user.role,
				profileCompleted: user.profileCompleted,
			},
			token,
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({ message: "Server error during login" });
	}
};

// Verify Firebase token and return user data
export const verifyFirebaseToken = async (req: Request, res: Response) => {
	try {
		console.log("Verify token request body:", req.body);
		const { idToken } = req.body;

		if (!idToken) {
			console.log("Missing idToken in verify request");
			return res.status(400).json({ message: "ID token is required" });
		}

		// Verify the Firebase token
		console.log("Verifying Firebase token...");
		const decodedToken = await admin.auth().verifyIdToken(idToken);
		console.log("Token verified, decoded token:", decodedToken);

		// Find user by Firebase UID
		console.log("Looking for user with firebaseUid:", decodedToken.uid);
		const user = await User.findOne({ firebaseUid: decodedToken.uid });

		if (!user) {
			console.log("User not found with firebaseUid:", decodedToken.uid);
			return res.status(404).json({ message: "User not found in database" });
		}

		console.log("User found:", user);

		// Generate JWT token
		const token = jwt.sign(
			{ id: user._id, email: user.email, role: user.role },
			JWT_SECRET as string,
			{ expiresIn: JWT_EXPIRATION as string }
		);

		return res.status(200).json({
			message: "Token verified successfully",
			user: {
				id: user._id,
				email: user.email,
				role: user.role,
				profileCompleted: user.profileCompleted,
			},
			token,
		});
	} catch (error) {
		console.error("Token verification error:", error);
		return res.status(401).json({ message: "Invalid or expired token" });
	}
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
