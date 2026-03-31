import express from 'express';
import { 
  getKYCStatus, 
  getUserKYC, 
  retryKYCVerification 
} from '../controllers/kycController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route - Get KYC status by ID (no auth required for polling during registration)
router.get('/status/:kycId', getKYCStatus);

// Protected routes
router.get('/my-kyc', authenticate, getUserKYC);
router.post('/retry/:kycId', authenticate, retryKYCVerification);

export default router;
