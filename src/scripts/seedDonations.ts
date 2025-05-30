import mongoose from "mongoose";
import dotenv from "dotenv";
import Donation from "../models/donation.model";
import User from "../models/user.model";
import Cause from "../models/cause.model";
import { DonationType, DonationStatus } from "../models/donation.model";

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/charity_donation";

const seedDonations = async () => {
	try {
		// Connect to MongoDB
		await mongoose.connect(MONGODB_URI);
		console.log("Connected to MongoDB");

		// Find existing users and causes
		const donors = await User.find({ role: "donor" }).limit(5);
		const organizations = await User.find({ role: "organization" }).limit(3);
		const causes = await Cause.find().limit(10);

		if (donors.length === 0 || organizations.length === 0 || causes.length === 0) {
			console.log("Not enough users or causes found. Please create some users and causes first.");
			return;
		}

		console.log(`Found ${donors.length} donors, ${organizations.length} organizations, ${causes.length} causes`);

		// Sample donation data
		const sampleDonations = [
			// CLOTHES donations
			{
				donor: donors[0]._id,
				organization: organizations[0]._id,
				cause: causes[0]._id,
				type: DonationType.CLOTHES,
				status: DonationStatus.CONFIRMED,
				description: "Winter clothes for children",
				quantity: 25,
				unit: "pieces",
				scheduledDate: new Date("2024-01-15"),
				scheduledTime: "10:00",
				isPickup: true,
				contactPhone: "+1234567890",
				contactEmail: "donor1@example.com",
				createdAt: new Date("2024-01-10"),
			},
			{
				donor: donors[1]._id,
				organization: organizations[1]._id,
				cause: causes[1]._id,
				type: DonationType.CLOTHES,
				status: DonationStatus.RECEIVED,
				description: "Summer clothes for adults",
				quantity: 15,
				unit: "pieces",
				scheduledDate: new Date("2024-02-20"),
				scheduledTime: "14:00",
				isPickup: false,
				contactPhone: "+1234567891",
				contactEmail: "donor2@example.com",
				createdAt: new Date("2024-02-15"),
			},
			{
				donor: donors[2]._id,
				organization: organizations[0]._id,
				cause: causes[2]._id,
				type: DonationType.CLOTHES,
				status: DonationStatus.CONFIRMED,
				description: "School uniforms",
				quantity: 30,
				unit: "pieces",
				scheduledDate: new Date("2024-03-10"),
				scheduledTime: "09:00",
				isPickup: true,
				contactPhone: "+1234567892",
				contactEmail: "donor3@example.com",
				createdAt: new Date("2024-03-05"),
			},
			// FOOD donations
			{
				donor: donors[0]._id,
				organization: organizations[1]._id,
				cause: causes[3]._id,
				type: DonationType.FOOD,
				status: DonationStatus.CONFIRMED,
				description: "Canned food and dry goods",
				quantity: 50,
				unit: "kg",
				scheduledDate: new Date("2024-01-25"),
				scheduledTime: "11:00",
				isPickup: false,
				contactPhone: "+1234567890",
				contactEmail: "donor1@example.com",
				createdAt: new Date("2024-01-20"),
			},
			{
				donor: donors[3]._id,
				organization: organizations[2]._id,
				cause: causes[4]._id,
				type: DonationType.FOOD,
				status: DonationStatus.RECEIVED,
				description: "Fresh vegetables and fruits",
				quantity: 75,
				unit: "kg",
				scheduledDate: new Date("2024-02-28"),
				scheduledTime: "08:00",
				isPickup: true,
				contactPhone: "+1234567893",
				contactEmail: "donor4@example.com",
				createdAt: new Date("2024-02-25"),
			},
			// BOOKS donations
			{
				donor: donors[1]._id,
				organization: organizations[0]._id,
				cause: causes[5]._id,
				type: DonationType.BOOKS,
				status: DonationStatus.CONFIRMED,
				description: "Educational books for children",
				quantity: 100,
				unit: "books",
				scheduledDate: new Date("2024-03-15"),
				scheduledTime: "13:00",
				isPickup: false,
				contactPhone: "+1234567891",
				contactEmail: "donor2@example.com",
				createdAt: new Date("2024-03-10"),
			},
			// TOYS donations
			{
				donor: donors[4]._id,
				organization: organizations[1]._id,
				cause: causes[6]._id,
				type: DonationType.TOYS,
				status: DonationStatus.RECEIVED,
				description: "Educational toys for toddlers",
				quantity: 20,
				unit: "pieces",
				scheduledDate: new Date("2024-04-05"),
				scheduledTime: "15:00",
				isPickup: true,
				contactPhone: "+1234567894",
				contactEmail: "donor5@example.com",
				createdAt: new Date("2024-04-01"),
			},
			// FURNITURE donations
			{
				donor: donors[2]._id,
				organization: organizations[2]._id,
				cause: causes[7]._id,
				type: DonationType.FURNITURE,
				status: DonationStatus.CONFIRMED,
				description: "Office chairs and desks",
				quantity: 5,
				unit: "pieces",
				scheduledDate: new Date("2024-04-20"),
				scheduledTime: "10:30",
				isPickup: true,
				contactPhone: "+1234567892",
				contactEmail: "donor3@example.com",
				createdAt: new Date("2024-04-15"),
			},
			// HOUSEHOLD donations
			{
				donor: donors[0]._id,
				organization: organizations[0]._id,
				cause: causes[8]._id,
				type: DonationType.HOUSEHOLD,
				status: DonationStatus.RECEIVED,
				description: "Kitchen utensils and appliances",
				quantity: 12,
				unit: "items",
				scheduledDate: new Date("2024-05-10"),
				scheduledTime: "12:00",
				isPickup: false,
				contactPhone: "+1234567890",
				contactEmail: "donor1@example.com",
				createdAt: new Date("2024-05-05"),
			},
			// More CLOTHES donations for better analytics
			{
				donor: donors[3]._id,
				organization: organizations[1]._id,
				cause: causes[9]._id,
				type: DonationType.CLOTHES,
				status: DonationStatus.CONFIRMED,
				description: "Baby clothes and accessories",
				quantity: 40,
				unit: "pieces",
				scheduledDate: new Date("2024-05-25"),
				scheduledTime: "16:00",
				isPickup: true,
				contactPhone: "+1234567893",
				contactEmail: "donor4@example.com",
				createdAt: new Date("2024-05-20"),
			},
		];

		// Clear existing donations (optional - remove this line if you want to keep existing data)
		// await Donation.deleteMany({});
		// console.log("Cleared existing donations");

		// Insert sample donations
		const insertedDonations = await Donation.insertMany(sampleDonations);
		console.log(`Successfully inserted ${insertedDonations.length} sample donations`);

		// Display summary
		const donationsByType = await Donation.aggregate([
			{
				$match: {
					status: { $in: [DonationStatus.CONFIRMED, DonationStatus.RECEIVED] }
				}
			},
			{
				$group: {
					_id: "$type",
					count: { $sum: 1 },
					totalQuantity: { $sum: "$quantity" }
				}
			},
			{
				$sort: { count: -1 }
			}
		]);

		console.log("\nDonation Summary:");
		donationsByType.forEach(item => {
			console.log(`${item._id}: ${item.count} donations, ${item.totalQuantity} total quantity`);
		});

	} catch (error) {
		console.error("Error seeding donations:", error);
	} finally {
		await mongoose.disconnect();
		console.log("Disconnected from MongoDB");
	}
};

// Run the seed script
if (require.main === module) {
	seedDonations();
}

export default seedDonations;
