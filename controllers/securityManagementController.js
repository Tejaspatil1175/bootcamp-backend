import SecurityAlert from "../models/SecurityAlert.js";
import User from "../models/User.js";

/**
 * Get all security alerts with filters
 * GET /api/admin/security/security-alerts
 */
export const getSecurityAlerts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      severity = '',
      status = '',
      type = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};

    // Filters
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const alerts = await SecurityAlert.find(filter)
      .populate('userId', 'name email phoneNumber accountStatus')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await SecurityAlert.countDocuments(filter);

    const formattedAlerts = alerts.map(alert => ({
      alertId: alert._id,
      userId: {
        userId: alert.userId._id,
        name: alert.userId.name,
        email: alert.userId.email
      },
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      metadata: alert.metadata,
      resolvedBy: alert.resolvedBy,
      resolvedAt: alert.resolvedAt,
      resolutionNotes: alert.resolutionNotes,
      createdAt: alert.createdAt
    }));

    res.json({
      success: true,
      data: {
        alerts: formattedAlerts,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get security alerts error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch security alerts",
      error: error.message
    });
  }
};

/**
 * Get alert details
 * GET /api/admin/security/security-alerts/:alertId
 */
export const getAlertDetails = async (req, res) => {
  try {
    const { alertId } = req.params;

    const alert = await SecurityAlert.findById(alertId)
      .populate('userId', 'name email phoneNumber accountStatus upiId');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    res.json({
      success: true,
      data: alert
    });

  } catch (error) {
    console.error('Get alert details error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch alert details",
      error: error.message
    });
  }
};

/**
 * Resolve security alert
 * PUT /api/admin/security/security-alerts/:alertId/resolve
 */
export const resolveAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    const alert = await SecurityAlert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    alert.status = 'RESOLVED';
    alert.resolvedBy = req.admin.adminId;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = notes || '';

    await alert.save();

    res.json({
      success: true,
      message: "Alert resolved successfully",
      data: {
        alertId: alert._id,
        status: alert.status,
        resolvedAt: alert.resolvedAt
      }
    });

  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to resolve alert",
      error: error.message
    });
  }
};

/**
 * Get frozen accounts
 * GET /api/admin/security/frozen-accounts
 */
export const getFrozenAccounts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10
    } = req.query;

    const users = await User.find({ accountStatus: 'frozen' })
      .select('-password')
      .sort({ accountFrozenAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments({ accountStatus: 'frozen' });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get frozen accounts error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch frozen accounts",
      error: error.message
    });
  }
};

/**
 * Unfreeze user account
 * POST /api/admin/security/unfreeze-account/:userId
 */
export const unfreezeAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.accountStatus = 'active';
    user.accountFrozenAt = null;
    user.accountFrozenReason = null;

    await user.save();

    // Create audit log
    const alert = new SecurityAlert({
      userId: user._id,
      type: 'ACCOUNT_UNFROZEN',
      severity: 'LOW',
      status: 'RESOLVED',
      message: `Account unfrozen by admin. Notes: ${notes || 'No notes provided'}`,
      resolvedBy: req.admin.adminId,
      resolvedAt: new Date(),
      resolutionNotes: notes
    });

    await alert.save();

    res.json({
      success: true,
      message: "Account unfrozen successfully",
      data: {
        userId: user._id,
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error('Unfreeze account error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to unfreeze account",
      error: error.message
    });
  }
};

/**
 * Get security statistics
 * GET /api/admin/security/stats
 */
export const getSecurityStats = async (req, res) => {
  try {
    const totalAlerts = await SecurityAlert.countDocuments();
    const openAlerts = await SecurityAlert.countDocuments({ status: 'OPEN' });
    const resolvedAlerts = await SecurityAlert.countDocuments({ status: 'RESOLVED' });
    
    const criticalAlerts = await SecurityAlert.countDocuments({ 
      severity: 'CRITICAL',
      status: 'OPEN'
    });

    const highAlerts = await SecurityAlert.countDocuments({ 
      severity: 'HIGH',
      status: 'OPEN'
    });

    const frozenAccounts = await User.countDocuments({ accountStatus: 'frozen' });
    const suspendedAccounts = await User.countDocuments({ accountStatus: 'suspended' });

    // Alerts by type
    const alertsByType = await SecurityAlert.aggregate([
      { $match: { status: 'OPEN' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Alerts by severity
    const alertsBySeverity = await SecurityAlert.aggregate([
      { $match: { status: 'OPEN' } },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent alerts trend (last 7 days)
    const alertsTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = await SecurityAlert.countDocuments({
        createdAt: { $gte: dayStart, $lte: dayEnd }
      });
      
      alertsTrend.push({
        date: dayStart.toLocaleDateString(),
        count
      });
    }

    res.json({
      success: true,
      data: {
        totalAlerts,
        openAlerts,
        resolvedAlerts,
        criticalAlerts,
        highAlerts,
        frozenAccounts,
        suspendedAccounts,
        alertsByType,
        alertsBySeverity,
        alertsTrend
      }
    });

  } catch (error) {
    console.error('Get security stats error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch security statistics",
      error: error.message
    });
  }
};

export default {
  getSecurityAlerts,
  getAlertDetails,
  resolveAlert,
  getFrozenAccounts,
  unfreezeAccount,
  getSecurityStats
};
