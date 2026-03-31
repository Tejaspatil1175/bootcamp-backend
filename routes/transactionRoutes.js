import express from 'express';
import {
  initiateTransaction,
  getTransactionHistory,
  getTransactionDetails,
  getTransactionStats,
  cancelTransaction,
  getFlaggedTransactions,
  reviewTransaction,
  getAdminTransactionStats
} from '../controllers/transactionController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { adminAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// ==================== USER ROUTES ====================

// Initiate a new transaction
router.post('/initiate', authenticate, initiateTransaction);

// Get transaction history
router.get('/history', authenticate, getTransactionHistory);

// Get single transaction details
router.get('/:transactionId', authenticate, getTransactionDetails);

// Get transaction statistics
router.get('/stats/user', authenticate, getTransactionStats);

// Cancel pending transaction
router.post('/:transactionId/cancel', authenticate, cancelTransaction);

// ==================== ADMIN ROUTES ====================

// Get flagged/blocked transactions
router.get('/admin/flagged', adminAuth, getFlaggedTransactions);

// Review blocked transaction
router.put('/admin/:transactionId/review', adminAuth, reviewTransaction);

// Get admin dashboard statistics
router.get('/admin/stats', adminAuth, getAdminTransactionStats);

export default router;
