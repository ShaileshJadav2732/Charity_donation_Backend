import { Request, Response } from "express";
import User from "../../models/User.model";
import jwt from "jsonwebtoken";
import { admin } from "../../config/firebase-admin"; // You'll need to create this

export const firebaseAuth = async (req: Request, res: Response) => {
	try {
		const { idToken, role } = req.body;

		if (!idToken) {
			return res.status(400).json({ message: "Firebase ID token is required" });
		}

		// Verify the Firebase token
		const decodedToken = await admin.auth().verifyIdToken(idToken);
		const { uid, email, name, picture } = decodedToken;

		// Check if user exists
		let user = await User.findOne({ firebaseUid: uid });

		if (user) {
			// User exists, update if needed
			if (
				(name && name !== user.displayName) ||
				(picture && picture !== user.photoURL)
			) {
				user.displayName = name || user.displayName;
				user.photoURL = picture || user.photoURL;
				await user.save();
			}
		} else {
			// Create new user
			user = await User.create({
				username: email ? email.split("@")[0] : `user_${uid}`, // Default username from email or uid
				email: email || "",
				firebaseUid: uid,
				displayName: name || "",
				photoURL: picture || "",
				role: role || "donor", // Default role
			});
		}

		// Create JWT token
		const token = jwt.sign(
			{ id: user._id, role: user.role },
			process.env.JWT_SECRET || "your-secret-key",
			{ expiresIn: "7d" }
		);

		res.status(200).json({
			message: "Authentication successful",
			token,
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				role: user.role,
				displayName: user.displayName,
				photoURL: user.photoURL,
			},
		});
	} catch (error) {
		console.error("Firebase authentication error:", error);
		res.status(401).json({ message: "Authentication failed" });
	}
};
