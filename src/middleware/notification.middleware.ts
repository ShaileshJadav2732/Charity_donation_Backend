import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notificationService";

// Extend Request interface to include notificationService
declare global {
	namespace Express {
		interface Request {
			notificationService?: NotificationService;
		}
	}
}

export const attachNotificationService = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const app = req.app;
	const io = app.get("io");

	if (io) {
		req.notificationService = new NotificationService(io);
	}

	next();
};
