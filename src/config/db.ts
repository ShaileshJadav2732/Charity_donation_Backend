import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
	try {
		const mongoURI =
			process.env.MONGO_URI || "mongodb://localhost:27017/charity_donation";
		await mongoose.connect(mongoURI);
		console.log("MongoDB connected successfully");
	} catch (error) {
		console.error("Error connecting to MongoDB:", error);
		process.exit(1); // Exit process with failure
	}
};

export default connectDB;
