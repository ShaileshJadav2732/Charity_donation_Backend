import { Router } from "express";
import {
	getNotifications,
	markNotificationAsRead,
	dismissNotification,
} from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";
import { RequestHandler } from "express";

const router = Router();

router.use(authenticate);

// Cast controllers to RequestHandler to ensure type compatibility
router.get("/", getNotifications as unknown as RequestHandler);

router.patch(
	"/:notificationId/read",
	markNotificationAsRead as unknown as RequestHandler
);

router.delete(
	"/:notificationId",
	dismissNotification as unknown as RequestHandler
);

export default router;
