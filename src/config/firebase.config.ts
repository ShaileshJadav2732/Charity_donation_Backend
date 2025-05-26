import * as admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

// Path to the service account key file
const serviceAccountPath = path.resolve(
	__dirname,
	"../../charity-donation-83eec-firebase-adminsdk-fbsvc-33391fe0ec.json"
);

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
	try {
		// Check if service account file exists
		if (fs.existsSync(serviceAccountPath)) {
			// Initialize with service account file
			const serviceAccount = require(serviceAccountPath);
			admin.initializeApp({
				credential: admin.credential.cert(serviceAccount),
			});
		} else {
			// Initialize with environment variables
			admin.initializeApp({
				credential: admin.credential.cert({
					projectId: process.env.FIREBASE_PROJECT_ID,
					clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
					// Replace newlines in the private key
					privateKey: process.env.FIREBASE_PRIVATE_KEY,
				}),
			});
		}
		console.log("Firebase Admin SDK initialized successfully");
	} catch (error) {
		console.error("Firebase Admin SDK initialization error:", error);
	}
}

export default admin;
