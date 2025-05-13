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
import helmet from "helmet";
import compression from "compression";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// Connect to MongoDB
mongoose
	.connect(process.env.MONGODB_URI!)
	.then(() => {
		console.log("Connected to MongoDB");
	})
	.catch((error) => {
		console.error("MongoDB connection error:", error);
		process.exit(1);
	});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/causes", causeRoutes);
app.use("/api/campaigns", campaignRoutes);

// Health check route
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ status: "ok", message: "Server is running" });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: Function) => {
	console.error(err.stack);
	res.status(err.status || 500).json({
		status: "error",
		message: err.message || "Internal server error",
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
