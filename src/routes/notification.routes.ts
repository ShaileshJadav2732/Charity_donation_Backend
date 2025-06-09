import { Router } from "express";
import {
	getNotifications,
	markNotificationAsRead,
	dismissNotification,
} from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", getNotifications);

router.patch("/:notificationId/read", markNotificationAsRead);

router.delete("/:notificationId", dismissNotification);

export default router;
