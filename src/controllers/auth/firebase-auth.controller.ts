import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import admin from "../../config/firebase";
import User from "../../models/user.model";
import Donor from "../../models/donor.model";
import Organization from "../../models/organization.model";

// Helper functio n to get Firebase error messages
export const getFirebaseErrorMessage = (code: string): string => {
	const errorMap: Record<string, string> = {
		"auth/email-already-exists": "The email address is already in use.",
		"auth/invalid-email": "The email address is invalid.",
		"auth/invalid-password": "The password is invalid.",
		"auth/user-not-found": "No user found with this email.",
		"auth/wrong-password": "Incorrect password.",
		"auth/id-token-expired": "Firebase ID token has expired.",
		"auth/id-token-revoked": "Firebase ID token has been revoked.",
		"auth/invalid-id-token": "Firebase ID token is invalid.",
	};

	return errorMap[code] || "Authentication failed. Please try again.";
};

// Firebase Authentication Controller
export const firebaseAuth = async (req: Request, res: Response) => {
	const { idToken, role, username, userData, action } = req.body;

	if (!idToken) {
		return res.status(400).json({ message: "ID token is required" });
	}

	try {
		// Verify the ID token
		const decodedToken = await admin.auth().verifyIdToken(idToken);
		const { uid, email, email_verified, name, picture } = decodedToken;

		// Check if user exists in our database
		let user = await User.findOne({ firebaseUid: uid });
		let isNewUser = false;

		if (!user) {
			// If action is login and user doesn't exist, return error
			if (action === "login") {
				return res
					.status(404)
					.json({ message: "User not found. Please sign up first." });
			}

			// Create new user if doesn't exist (for signup action)
			isNewUser = true;

			// Validate required fields for signup
			if (!role) {
				return res.status(400).json({ message: "Role is required for signup" });
			}

			// Create username if not provided
			const finalUsername =
				username || email?.split("@")[0] || `user_${Date.now()}`;

			// Create user document
			user = await User.create({
				email: email || "",
				firebaseUid: uid,
				role: role,
				displayName: name || userData?.displayName || finalUsername,
				photoURL: picture || userData?.photoURL || "",
				emailVerified: email_verified || userData?.emailVerified || false,
			});

			// Create profile document based on role
			if (role === "donor") {
				await Donor.create({
					user: user._id,
					isProfileCompleted: false,
				});
			} else if (role === "organization") {
				await Organization.create({
					user: user._id,
					orgName: user.displayName,
					isProfileCompleted: false,
				});
			}
		}

		// Generate JWT token
		const token = jwt.sign(
			{
				id: user._id,
				role: user.role,
				email: user.email,
			},
			process.env.JWT_SECRET || "your-secret-key",
			{ expiresIn: "7d" }
		);

		// Send response
		res.status(200).json({
			message: isNewUser ? "Registration successful" : "Login successful",
			token,
			user: {
				id: user._id,

				email: user.email,
				role: user.role,
				displayName: user.displayName,
				photoURL: user.photoURL,
				isNewUser,
			},
		});
	} catch (error) {
		console.error("Firebase authentication error:", error);

		// Provide more specific error messages based on firebase error codes
		const errorMessage =
			error && typeof error === "object" && "code" in error
				? getFirebaseErrorMessage(error.code as string)
				: "Authentication failed";

		res.status(401).json({ message: errorMessage });
	}
};

// Separate controllers for signup and login
export const firebaseSignup = async (req: Request, res: Response) => {
	req.body.action = "signup";
	return firebaseAuth(req, res);
};

export const firebaseLogin = async (req: Request, res: Response) => {
	req.body.action = "login";
	return firebaseAuth(req, res);
};

// Define a custom interface to extend the Request type
interface AuthenticatedRequest extends Request {
	user?: any;
}

// Middleware to validate Firebase tokens for protected routes
export const validateFirebaseToken = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ message: "Authentication required" });
		}

		const idToken = authHeader.split("Bearer ")[1];

		// Verify the token
		const decodedToken = await admin.auth().verifyIdToken(idToken);

		// Attach the user info to the request for use in protected routes
		req.user = decodedToken;

		next();
	} catch (error) {
		console.error("Token validation error:", error);
		res
			.status(401)
			.json({ message: "Invalid or expired authentication token" });
	}
};

// Middleware to check if the user has required roles
export const requireRole = (roles: string | string[]) => {
	return async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction
	) => {
		try {
			if (!req.user) {
				// Validate token first if not already validated
				return validateFirebaseToken(req, res, async () => {
					await checkUserRole(req, res, next, roles);
				});
			} else {
				// Token already validated, just check role
				await checkUserRole(req, res, next, roles);
			}
		} catch (error) {
			console.error("Role validation error:", error);
			res.status(500).json({ message: "Server error during role validation" });
		}
	};
};

// Helper function to check user roles
async function checkUserRole(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
	roles: string | string[]
) {
	try {
		const firebaseUid = req.user.uid;

		// Find the user in database to check role
		const user = await User.findOne({ firebaseUid });

		if (!user) {
			return res.status(404).json({ message: "User not found in database" });
		}

		const allowedRoles = Array.isArray(roles) ? roles : [roles];

		if (allowedRoles.includes(user.role)) {
			// Add user data to request for use in route handlers
			req.user.dbUser = user;
			next();
		} else {
			res.status(403).json({
				message: "Access denied. Insufficient permissions.",
			});
		}
	} catch (error) {
		console.error("Role checking error:", error);
		res.status(500).json({ message: "Server error during role validation" });
	}
}

// Get profile status
export const getProfileStatus = async (
	req: AuthenticatedRequest,
	res: Response
) => {
	try {
		if (!req.user || !req.user.dbUser) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		const { role, _id } = req.user.dbUser;

		if (role === "donor") {
			const donor = await Donor.findOne({ user: _id });
			return res.status(200).json({
				role: "donor",
				isProfileComplete: donor ? donor.isProfileCompleted : false,
			});
		} else if (role === "organization") {
			const organization = await Organization.findOne({ user: _id });
			return res.status(200).json({
				role: "organization",
				isProfileComplete: organization
					? organization.isProfileCompleted
					: false,
			});
		} else if (role === "admin") {
			// Admins don't need to complete profiles
			return res.status(200).json({
				role: "admin",
				isProfileComplete: true,
			});
		}

		return res.status(400).json({
			message: "Invalid user role",
			isProfileComplete: false,
		});
	} catch (error) {
		console.error("Profile status error:", error);
		res.status(500).json({ message: "Failed to get profile status" });
	}
};
