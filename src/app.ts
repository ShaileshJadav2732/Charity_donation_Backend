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

import notificationRoutes from "./routes/notification.routes";
import messageRoutes from "./routes/message.routes";

import donationRoutes from "./routes/donation.routes";
import organizationRoutes from "./routes/organization.routes";
import paymentRoutes from "./routes/payment.routes";
import uploadRoutes from "./routes/upload.routes";
import { NotificationService } from "./services/notificationService";
import { handleStripeWebhook } from "./controllers/payment.controller";
import { authenticate } from "./middleware/auth.middleware";
// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
	"http://localhost:3000",
	"http://localhost:3001",
	"https://a160-115-242-213-210.ngrok-free.app/", // optional, for ngrok testing
];

app.use(
	cors({
		origin: function (origin, callback) {
			// allow requests with no origin (like mobile apps, curl, postman)
			if (!origin || allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Accept"],
		exposedHeaders: ["Content-Disposition"],
	})
);

app.post(
	"/api/payments/webhook",
	express.raw({ type: "application/json" }),
	handleStripeWebhook
);

// Body parsing middleware (MUST be before ALL routes that need JSON parsing)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Message routes (now after JSON parsing middleware)
app.use("/api/messages", messageRoutes);

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

app.use("/api/notifications", notificationRoutes);

app.use("/api/donations", donationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payments", paymentRoutes);

// Health check route
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ status: "ok", message: "Server is running" });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: Function) => {
	console.error("Error:", err);
});
// 404 route
// app.use, (req: Request, res: Response) => {
// 	res.status(404).json({ message: "Route not found" });
// });

export default app;
