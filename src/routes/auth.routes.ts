import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-token', authController.verifyFirebaseToken);
router.get('/me', verifyToken, authController.getCurrentUser);

export default router;
