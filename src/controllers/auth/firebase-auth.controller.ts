import { Request, Response, NextFunction } from "express";
import admin from "../../config/firebase";
import User from "../../models/user.model";
import Donor from "../../models/donor.model";
import Organization from "../../models/organization.model";

// Helper function to get Firebase error messages
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
		// Verify the Firebase ID token
		const decodedToken = await admin.auth().verifyIdToken(idToken);
		const { uid, email, email_verified, name, picture } = decodedToken;

		// Check if user exists in our database
		let user = await User.findOne({ firebaseUid: uid });
		let isNewUser = false;

		if (!user) {
			if (action === "login") {
				return res
					.status(404)
					.json({ message: "User not found. Please sign up first." });
			}

			isNewUser = true;

			if (!role) {
				return res.status(400).json({ message: "Role is required for signup" });
			}

			const finalUsername =
				username || email?.split("@")[0] || `user_${Date.now()}`;

			user = await User.create({
				email: email || "",
				firebaseUid: uid,
				role,
				displayName: name || userData?.displayName || finalUsername,
				photoURL: picture || userData?.photoURL || "",
				emailVerified: email_verified || userData?.emailVerified || false,
			});

			if (role === "donor") {
				await Donor.create({ user: user._id, isProfileCompleted: false });
			} else if (role === "organization") {
				await Organization.create({
					user: user._id,
					orgName: user.displayName,
					isProfileCompleted: false,
				});
			}
		}

		// Return only Firebase user info
		res.status(200).json({
			message: isNewUser ? "Registration successful" : "Login successful",
			user: {
				id: user._id,
				email: user.email,
				role: user.role,
				displayName: user.displayName,
				photoURL: user.photoURL,
				isNewUser,
			},
			idToken,
		});
	} catch (error) {
		console.error("Firebase authentication error:", error);

		const errorMessage =
			error && typeof error === "object" && "code" in error
				? getFirebaseErrorMessage(error.code as string)
				: "Authentication failed";

		res.status(401).json({ message: errorMessage });
	}
};

// Signup & Login
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

// Middleware to validate Firebase tokens
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
		const decodedToken = await admin.auth().verifyIdToken(idToken);

		req.user = decodedToken;
		next();
	} catch (error) {
		console.error("Token validation error:", error);
		res.status(401).json({ message: "Invalid or expired Firebase token" });
	}
};

// Role-based middleware
export const requireRole = (roles: string | string[]) => {
	return async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction
	) => {
		try {
			if (!req.user) {
				return validateFirebaseToken(req, res, async () => {
					await checkUserRole(req, res, next, roles);
				});
			} else {
				await checkUserRole(req, res, next, roles);
			}
		} catch (error) {
			console.error("Role validation error:", error);
			res.status(500).json({ message: "Server error during role validation" });
		}
	};
};

async function checkUserRole(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
	roles: string | string[]
) {
	try {
		const firebaseUid = req.user.uid;
		const user = await User.findOne({ firebaseUid });

		if (!user) {
			return res.status(404).json({ message: "User not found in database" });
		}

		const allowedRoles = Array.isArray(roles) ? roles : [roles];

		if (allowedRoles.includes(user.role)) {
			req.user.dbUser = user;
			next();
		} else {
			res
				.status(403)
				.json({ message: "Access denied. Insufficient permissions." });
		}
	} catch (error) {
		console.error("Role checking error:", error);
		res.status(500).json({ message: "Error checking user role" });
	}
}

// Get profile completion status
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
				isProfileComplete: donor?.isProfileCompleted ?? false,
			});
		} else if (role === "organization") {
			const org = await Organization.findOne({ user: _id });
			return res.status(200).json({
				role: "organization",
				isProfileComplete: org?.isProfileCompleted ?? false,
			});
		} else if (role === "admin") {
			return res.status(200).json({
				role: "admin",
				isProfileComplete: true,
			});
		}

		return res
			.status(400)
			.json({ message: "Invalid user role", isProfileComplete: false });
	} catch (error) {
		console.error("Profile status error:", error);
		res.status(500).json({ message: "Failed to get profile status" });
	}
};
