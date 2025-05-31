import mongoose from "mongoose";
import dotenv from "dotenv";
import Donation, { DonationType, DonationStatus } from "../models/donation.model";
import User from "../models/user.model";
import Organization from "../models/organization.model";
import Cause from "../models/cause.model";

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/charity_donation";

const testDonationFlow = async () => {
	try {
		// Connect to MongoDB
		await mongoose.connect(MONGODB_URI);
		console.log("Connected to MongoDB");

		// Find a donor user
		const donor = await User.findOne({ role: "donor" });
		if (!donor) {
			console.log("No donor found. Please create a donor user first.");
			return;
		}
		console.log(`Found donor: ${donor.email}`);

		// Find an organization user
		const orgUser = await User.findOne({ role: "organization" });
		if (!orgUser) {
			console.log("No organization user found. Please create an organization user first.");
			return;
		}
		console.log(`Found organization user: ${orgUser.email}`);

		// Find the organization document
		const organization = await Organization.findOne({ userId: orgUser._id });
		if (!organization) {
			console.log("No organization document found for the organization user.");
			return;
		}
		console.log(`Found organization: ${organization.name}`);

		// Find a cause belonging to this organization
		const cause = await Cause.findOne({ organizationId: organization._id });
		if (!cause) {
			console.log("No cause found for this organization. Please create a cause first.");
			return;
		}
		console.log(`Found cause: ${cause.title}`);
		console.log(`Current raised amount: ₹${cause.raisedAmount}`);

		// Create a test donation
		const testDonation = new Donation({
			donor: donor._id,
			organization: organization._id,
			cause: cause._id,
			type: DonationType.CLOTHES,
			status: DonationStatus.CONFIRMED, // Set to CONFIRMED so it counts towards progress
			description: "Test donation - Winter clothes for children",
			quantity: 10,
			unit: "pieces",
			scheduledDate: new Date(),
			scheduledTime: "10:00",
			isPickup: true,
			contactPhone: "+1234567890",
			contactEmail: donor.email,
		});

		await testDonation.save();
		console.log(`Created test donation: ${testDonation._id}`);

		// Update the cause's raised amount (this should happen automatically in real flow)
		// For item donations, we'll add a symbolic amount
		const symbolicAmount = 500; // ₹500 for 10 pieces of clothes
		cause.raisedAmount += symbolicAmount;
		await cause.save();
		console.log(`Updated cause raised amount to: ₹${cause.raisedAmount}`);

		// Test queries that the frontend would make

		// 1. Check donor donations
		const donorDonations = await Donation.find({ donor: donor._id })
			.populate("organization", "name")
			.populate("cause", "title");
		console.log(`\nDonor has ${donorDonations.length} donations:`);
		donorDonations.forEach(d => {
			console.log(`- ${d.type}: ${d.description} (Status: ${d.status})`);
		});

		// 2. Check organization donations
		const orgDonations = await Donation.find({ organization: organization._id })
			.populate("donor", "email")
			.populate("cause", "title");
		console.log(`\nOrganization has ${orgDonations.length} donations:`);
		orgDonations.forEach(d => {
			console.log(`- ${d.type}: ${d.description} (Status: ${d.status}) from ${(d.donor as any)?.email}`);
		});

		// 3. Check analytics for CLOTHES donations
		const clothesDonations = await Donation.find({
			organization: organization._id,
			type: DonationType.CLOTHES,
			status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
		});
		console.log(`\nOrganization has ${clothesDonations.length} CLOTHES donations in CONFIRMED/RECEIVED status`);

		// 4. Check cause progress
		const updatedCause = await Cause.findById(cause._id);
		const progress = updatedCause ? (updatedCause.raisedAmount / updatedCause.targetAmount) * 100 : 0;
		console.log(`\nCause progress: ${progress.toFixed(1)}% (₹${updatedCause?.raisedAmount} / ₹${updatedCause?.targetAmount})`);

		console.log("\n✅ Donation flow test completed successfully!");

	} catch (error) {
		console.error("Error testing donation flow:", error);
	} finally {
		await mongoose.disconnect();
		console.log("Disconnected from MongoDB");
	}
};

// Run the test
if (require.main === module) {
	testDonationFlow();
}

export default testDonationFlow;
