import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./config/db.config";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";

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

// Health check route
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ status: "ok", message: "Server is running" });
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
