import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
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
import organizationRoutes from "./routes/organization.routes";
import { NotificationService } from "./services/notificationService";

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		// 	// allowedHeaders: ["Content-Type", "Authorization", "Accept"],
		// 	exposedHeaders: ["Content-Disposition"],
	})
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Middleware to attach notification service to requests
app.use((req: any, res, next) => {
	const io = app.get("io");
	if (io) {
		req.notificationService = new NotificationService(io);
	}
	next();
});

// Remove bodyParser.json() as it's redundant with express.json()
// app.use(bodyParser.json());

// Serve static files from uploads directory (MUST be before API routes)
app.use(
	"/uploads/donation-photos",
	express.static(path.join(__dirname, "../uploads/donation-photos"))
);
app.use(
	"/uploads/profile-photos",
	express.static(path.join(__dirname, "../uploads/profile-photos"))
);
app.use(
	"/uploads/receipts",
	express.static(path.join(__dirname, "../uploads/receipts"))
);

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
app.use("/api/organizations", organizationRoutes);
// Health check route
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ status: "ok", message: "Server is running" });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: Function) => {
	console.error("Error:", err);
});
// 404 route
app.use("*", (req: Request, res: Response) => {
	res.status(404).json({ message: "Route not found" });
});

export default app;
