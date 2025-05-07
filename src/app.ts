import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import connectDB from "./config/db";
import authRoutes from "./routes/auth.routes";
import donorRoutes from "./routes/donor.routes";
import adminRoutes from "./routes/admin.routes";
import organizationRoutes from "./routes/organization.routes";
import donationRoutes from "./routes/donation.routes";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(
	cors({
		origin: ["http://localhost:3000", process.env.FRONTEND_URL || ""],
		credentials: true,
	})
);
app.use(express.json({ limit: "50mb" })); // Increase limit for larger profile photos
app.use(morgan("dev"));

// Health check endpoint - for testing API connectivity
app.get("/api/health", (req, res) => {
	res.status(200).json({
		status: "ok",
		message: "Server is running",
		timestamp: new Date().toISOString(),
	});
});

// Routes with /api prefix
app.use("/api/auth", authRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/donations", donationRoutes);

// Connect to MongoDB and start server
connectDB()
	.then(() => {
		app.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
			console.log(`API available at http://localhost:${PORT}`);
		});
	})
	.catch((error) => {
		console.error("MongoDB connection error:", error);
		process.exit(1);
	});

export default app;
