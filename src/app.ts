import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./config/db";
// import roleRoutes from "./routes/role.routes";
import donorRoutes from "./routes/donor.routes";
import adminRoutes from "./routes/admin.routes";
import organizationRoutes from "./routes/organization.routes";
import "./types/request.types";
import donationRoutes from "./routes/donation.routes";
import authRoutes from "./routes/auth.routes";
// import { errorHandler } from "./middleware/error.middleware";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

connectDB();

// Routes
app.use("/api/auth", authRoutes);
// app.use("/api/roles", roleRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/donations", donationRoutes);

// Error handling middleware
// app.use(errorHandler);

// Connect to MongoDB and start server
mongoose
	.connect(
		process.env.MONGODB_URI || "mongodb://localhost:27017/charity_donation"
	)
	.then(() => {
		console.log("Connected to MongoDB");
		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
		});
	})
	.catch((error) => {
		console.error("MongoDB connection error:", error);
		process.exit(1);
	});

export default app;
