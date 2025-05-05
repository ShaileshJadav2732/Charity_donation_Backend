import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Check if Firebase Admin is already initialized to avoid multiple instances
if (!admin.apps.length) {
	try {
		console.log("Initializing Firebase Admin SDK...");

		// Private key needs to have newlines properly processed
		const privateKey = process.env.FIREBASE_PRIVATE_KEY
			? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
			: undefined;

		const firebaseConfig = {
			credential: admin.credential.cert({
				projectId: process.env.FIREBASE_PROJECT_ID,
				clientEmail:
					process.env.FIREBASE_CLIENT_EMAIL ||
					`firebase-adminsdk-fbsvc@${process.env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
				privateKey: privateKey,
			}),
			databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
		};

		admin.initializeApp(firebaseConfig);
		console.log("Firebase Admin SDK initialized successfully");
	} catch (error) {
		console.error("Firebase Admin SDK initialization error:", error);
	}
}

export default admin;
