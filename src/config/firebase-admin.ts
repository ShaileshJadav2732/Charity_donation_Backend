import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Check if all required variables are present
if (
	!process.env.FIREBASE_PROJECT_ID ||
	!process.env.FIREBASE_CLIENT_EMAIL ||
	!process.env.FIREBASE_PRIVATE_KEY
) {
	console.error("Missing Firebase credentials in environment variables");
	process.exit(1);
}

// Log to debug
console.log("Firebase Project ID:", process.env.FIREBASE_PROJECT_ID);

// Initialize the Firebase Admin SDK
if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId: process.env.FIREBASE_PROJECT_ID,
			clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
			privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
		}),
	});
}

export { admin };
