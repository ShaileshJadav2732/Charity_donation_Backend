import cors from "cors";
import dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import morgan from "morgan";
import connectDB from "./config/db.config";
import { handleStripeWebhook } from "./controllers/payment.controller";
import authRoutes from "./routes/auth.routes";
import campaignRoutes from "./routes/campaign.routes";
import causeRoutes from "./routes/cause.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import donationRoutes from "./routes/donation.routes";
import messageRoutes from "./routes/message.routes";
import notificationRoutes from "./routes/notification.routes";
import organizationRoutes from "./routes/organization.routes";
import paymentRoutes from "./routes/payment.routes";
import profileRoutes from "./routes/profile.routes";
import uploadRoutes from "./routes/upload.routes";
import voiceCommandRoutes from "./routes/voiceCommand.routes";

import { attachNotificationService } from "./middleware/notification.middleware";

dotenv.config();
const app: Application = express();

connectDB();

app.use(
	cors({
		origin: "*",
		credentials: true,
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

app.use("/api/messages", messageRoutes);

// Middleware to attach notification service to requests
app.use(attachNotificationService);

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
app.use("/api/voice-commands", voiceCommandRoutes);

// Health check route
app.get("/health", (req: Request, res: Response) => {
	res.status(200).json({ status: "ok", message: "Server is running" });
});

// // Error handling middleware
// app.use((err: any, req: Request, res: Response, next: Function) => {
// 	console.error("Error:", err);
// });

export default app;
