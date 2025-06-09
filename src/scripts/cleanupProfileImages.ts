import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define the schema for DonorProfile
const donorProfileSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	phoneNumber: String,
	address: String,
	city: String,
	state: String,
	country: String,
	bio: String,
	profileImage: String,
	cloudinaryPublicId: String,
	coverImage: String,
	joinDate: { type: Date, default: Date.now },
});

// Define the schema for OrganizationProfile
const organizationProfileSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	name: { type: String, required: true },
	description: { type: String, required: true },
	phoneNumber: String,
	email: String,
	website: String,
	address: String,
	city: String,
	state: String,
	country: String,
	logo: String,
	cloudinaryPublicId: String,
	coverImage: String,
	verified: { type: Boolean, default: false },
	joinDate: { type: Date, default: Date.now },
});

const DonorProfile = mongoose.model("DonorProfile", donorProfileSchema);
const OrganizationProfile = mongoose.model(
	"OrganizationProfile",
	organizationProfileSchema
);

async function cleanupProfileImages() {
	try {
		// Connect to MongoDB
		await mongoose.connect(
			process.env.MONGODB_URI || "mongodb://localhost:27017/charity-donation"
		);
		console.log("Connected to MongoDB");

		// Find and update donor profiles with legacy local image paths
		// Look for various patterns: /uploads/, profile-, or any non-http URLs
		const donorProfiles = await DonorProfile.find({
			$or: [
				{ profileImage: { $regex: /^\/uploads\// } },
				{ profileImage: { $regex: /profile-.*\.(jpg|jpeg|png|gif|webp)$/i } },
				{ profileImage: { $exists: true, $not: { $regex: /^https?:\/\// } } },
			],
		});

		console.log(
			`Found ${donorProfiles.length} donor profiles with legacy image paths`
		);

		for (const profile of donorProfiles) {
			// Clear the legacy local file path
			profile.profileImage = undefined;
			profile.cloudinaryPublicId = undefined;

			await profile.save();
		}

		// Find and update organization profiles with legacy local image paths
		const orgProfiles = await OrganizationProfile.find({
			$or: [
				{ logo: { $regex: /^\/uploads\// } },
				{ logo: { $regex: /profile-.*\.(jpg|jpeg|png|gif|webp)$/i } },
				{ logo: { $exists: true, $not: { $regex: /^https?:\/\// } } },
			],
		});

		console.log(
			`Found ${orgProfiles.length} organization profiles with legacy image paths`
		);

		for (const profile of orgProfiles) {
			console.log(
				`Cleaning up organization profile: ${profile._id}, old logo: ${profile.logo}`
			);

			// Clear the legacy local file path
			profile.logo = undefined;
			profile.cloudinaryPublicId = undefined;

			await profile.save();
		}
	} catch (error) {
	} finally {
		await mongoose.disconnect();

		process.exit(0);
	}
}

// Run the cleanup
cleanupProfileImages();
