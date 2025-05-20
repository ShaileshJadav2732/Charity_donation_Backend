import express, { Router } from 'express';
import { getNotifications, markNotificationAsRead, dismissNotification } from '../controllers/notification.controller'; // Adjust path
import { authenticate } from '../middleware/auth.middleware'; // Adjust path

const router: Router = express.Router();

// Fetch notifications
router.get('/:userId', authenticate, getNotifications);

// Mark notification as read
router.patch('/:notificationId/read', authenticate, markNotificationAsRead);

// Dismiss notification
router.delete('/:notificationId', authenticate, dismissNotification);

export default router;