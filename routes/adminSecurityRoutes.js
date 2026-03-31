/**
 * Get all active security alerts (Admin)
 */
import express from 'express';
import User from '../models/User.js';
import AccountSecurityService from '../services/accountSecurityService.js';
import { adminAuth } from '../middleware/authMiddleware.js';

const securityService = new AccountSecurityService();

const router = express.Router();

/**
 * Get all active security alerts (Admin)
 */
router.get('/security-alerts', adminAuth, async (req, res) => {
  try {
    const { severity, status } = req.query;
    
    const filter = {};
    if (severity) filter.severity = severity.toUpperCase();
    if (status) filter.status = status.toUpperCase();

    const result = await securityService.getAllActiveAlerts(filter);

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security alerts',
      error: error.message
    });
  }
});

/**
 * Get frozen accounts list (Admin)
 */
router.get('/frozen-accounts', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const frozenUsers = await User.find({ accountStatus: 'frozen' })
      .select('name email phoneNumber accountStatus accountFrozenAt accountFrozenReason')
      .sort({ accountFrozenAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments({ accountStatus: 'frozen' });

    res.json({
      success: true,
      data: {
        users: frozenUsers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch frozen accounts',
      error: error.message
    });
  }
});

/**
 * Resolve security alert (Admin)
 */
router.put('/security-alerts/:alertId/resolve', adminAuth, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;
    const adminId = req.admin.adminId;

    const SecurityAlert = (await import('../models/SecurityAlert.js')).default;
    
    const alert = await SecurityAlert.findOne({ alertId });
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.status = 'RESOLVED';
    alert.resolvedBy = adminId;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = notes;
    
    await alert.save();

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alert
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message
    });
  }
});

export default router;
