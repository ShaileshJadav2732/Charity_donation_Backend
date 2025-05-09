import { Router } from 'express';
import * as profileController from '../controllers/profile.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { isDonor, isOrganization } from '../middleware/role.middleware';

const router = Router();

// Donor profile routes
router.post('/donor', verifyToken, isDonor, profileController.completeDonorProfile);
router.get('/donor', verifyToken, isDonor, profileController.getDonorProfile);

// Organization profile routes
router.post('/organization', verifyToken, isOrganization, profileController.completeOrganizationProfile);
router.get('/organization', verifyToken, isOrganization, profileController.getOrganizationProfile);

export default router;
