import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./config/db.config";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import causeRoutes from "./routes/cause.routes";
import campaignRoutes from "./routes/campaign.routes";
import feedbackRoutes from "./routes/feedback.routes";
import notificationRoutes from "./routes/notification.routes";
import adminRoutes from "./routes/admin.routes";
import donationRoutes from "./routes/donation.routes";
// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/causes", causeRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/donations", donationRoutes);
// Health check route
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ status: "ok", message: "Server is running" });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: Function) => {
	console.error("Error:", err);

	// Check if it's a known operational error
	if (err.isOperational) {
		return res.status(err.statusCode).json({
			success: false,
			status: err.status,
			message: err.message
		});
	}

	// MongoDB errors
	if (err.name === 'CastError') {
		return res.status(400).json({
			success: false,
			status: 'fail',
			message: 'Invalid ID format'
		});
	}

	if (err.name === 'ValidationError') {
		return res.status(400).json({
			success: false,
			status: 'fail',
			message: 'Validation error in the request data'
		});
	}

	// For all other unexpected errors
	res.status(500).json({
		success: false,
		status: 'error',
		message: 'Something went wrong. Please try again later.'
	});
});

// Test route for debugging
app.get("/api/test", (req: Request, res: Response) => {
	console.log("Test endpoint called");
	res.status(200).json({ message: "Test endpoint working" });
});

// 404 route
app.use("*", (req: Request, res: Response) => {
	res.status(404).json({ message: "Route not found" });
});

export default app;
