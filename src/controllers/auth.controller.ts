import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import admin from "../config/firebase.config";
import User from "../models/user.model";
import { AuthRequest } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "7d";

if (!JWT_SECRET) throw new Error("JWT_SECRET is required");

// Helper functions
const generateToken = (user: any) =>
	jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
		expiresIn: JWT_EXPIRATION,
	});

const formatUser = (user: any) => ({
	id: user._id,
	email: user.email,
	role: user.role,
	profileCompleted: user.profileCompleted,
});

const handleError = (res: Response, status: number, message: string) =>
	res.status(status).json({ message });

export const register = async (req: Request, res: Response) => {
	try {
		const { email, firebaseUid, role } = req.body;

		if (!email || !firebaseUid || !role) {
			return handleError(res, 400, "Email, firebaseUid, and role are required");
		}

		const [existingUserByEmail, existingUserByUid] = await Promise.all([
			User.findOne({ email }),
			User.findOne({ firebaseUid }),
		]);

		if (existingUserByEmail)
			return handleError(res, 400, "User already exists with this email");
		if (existingUserByUid)
			return handleError(res, 400, "User already exists with this Firebase ID");

		const newUser = new User({
			email,
			firebaseUid,
			role,
			profileCompleted: false,
		});
		await newUser.save();

		const token = generateToken(newUser);

		return res.status(201).json({
			message: "User registered successfully",
			user: formatUser(newUser),
			token,
		});
	} catch (error) {
		return handleError(res, 500, "Server error during registration");
	}
};

export const login = async (req: Request, res: Response) => {
	try {
		const { firebaseUid } = req.body;

		if (!firebaseUid) return handleError(res, 400, "Firebase UID is required");

		const user = await User.findOne({ firebaseUid });
		if (!user) return handleError(res, 404, "User not found");

		const token = generateToken(user);

		return res.status(200).json({
			message: "Login successful",
			user: formatUser(user),
			token,
		});
	} catch (error) {
		return handleError(res, 500, "Server error during login");
	}
};

export const verifyFirebaseToken = async (req: Request, res: Response) => {
	try {
		const { idToken } = req.body;

		if (!idToken) return handleError(res, 400, "ID token is required");

		const decodedToken = await admin.auth().verifyIdToken(idToken);
		const user = await User.findOne({ firebaseUid: decodedToken.uid });

		if (!user) return handleError(res, 404, "User not found in database");

		const token = generateToken(user);

		return res.status(200).json({
			message: "Token verified successfully",
			user: formatUser(user),
			token,
		});
	} catch (error) {
		return handleError(res, 401, "Invalid or expired token");
	}
};

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.user) return handleError(res, 401, "Unauthorized");

		const user = await User.findById(req.user.id);
		if (!user) return handleError(res, 404, "User not found");

		return res.status(200).json({ user: formatUser(user) });
	} catch (error) {
		return handleError(res, 500, "Server error");
	}
};
