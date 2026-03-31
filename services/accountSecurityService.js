import User from '../models/User.js';
import SecurityAlert from '../models/SecurityAlert.js';
import Transaction from '../models/Transaction.js';
import NotificationService from './notificationService.js';

/**
 * Account Security Service
 * Handles account freeze/unfreeze and security alerts
 */
class AccountSecurityService {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Freeze user account due to suspicious activity
   */
  async freezeAccount(userId, reason, transaction = null) {
    try {
      console.log(`\n🔒 ========== FREEZING ACCOUNT ==========`);
      console.log(`👤 User ID: ${userId}`);
      console.log(`📋 Reason: ${reason}`);
      console.log(`==========================================\n`);

      // Update user account status
      const user = await User.findByIdAndUpdate(
        userId,
        {
          accountStatus: 'frozen',
          accountFrozenAt: new Date(),
          accountFrozenReason: reason,
          $inc: { 'fraudHistory.blockedTransactions': 1 },
          'fraudHistory.lastSuspiciousActivity': new Date()
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Create security alert
      const alert = await this.createSecurityAlert(
        userId,
        'ACCOUNT_FROZEN',
        'CRITICAL',
        `Account frozen due to ${reason}`,
        {
          transactionId: transaction?.transactionId,
          riskScore: transaction?.fraudCheck?.riskScore,
          riskFactors: transaction?.fraudCheck?.riskFactors
        }
      );

      // Add action to alert
      alert.actionsTaken.push({
        action: 'ACCOUNT_FROZEN',
        timestamp: new Date(),
        performedBy: 'SYSTEM'
      });
      await alert.save();

      // Send emergency notifications
      const notifications = await this.notificationService.sendAccountFrozenAlert(
        user,
        reason,
        transaction
      );

      console.log(`✅ Account frozen successfully`);
      console.log(`📧 Notifications sent: ${notifications.length}`);

      return {
        success: true,
        accountStatus: 'frozen',
        alertId: alert.alertId,
        notificationsSent: notifications.length
      };

    } catch (error) {
      console.error('❌ Account freeze error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unfreeze account (Admin only)
   */
  async unfreezeAccount(userId, adminId, notes) {
    try {
      console.log(`\n🔓 ========== UNFREEZING ACCOUNT ==========`);
      console.log(`👤 User ID: ${userId}`);
      console.log(`👮 Admin ID: ${adminId}`);
      console.log(`==========================================\n`);

      const user = await User.findByIdAndUpdate(
        userId,
        {
          accountStatus: 'active',
          accountFrozenAt: null,
          accountFrozenReason: null
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Find and resolve active security alerts
      const activeAlerts = await SecurityAlert.find({
        userId,
        status: 'ACTIVE',
        alertType: 'ACCOUNT_FROZEN'
      });

      for (const alert of activeAlerts) {
        alert.status = 'RESOLVED';
        alert.resolvedBy = adminId;
        alert.resolvedAt = new Date();
        alert.resolutionNotes = notes;
        await alert.save();
      }

      // Send notification
      if (user.email) {
        await this.notificationService.sendEmail(
          user.email,
          '✅ Account Unfrozen - Access Restored',
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #22c55e;">✅ Account Access Restored</h2>
              <p>Your account has been unfrozen and is now active.</p>
              
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Notes:</strong> ${notes || 'N/A'}</p>
              </div>
              
              <p>You can now use your account normally. If you have any questions, please contact support.</p>
            </div>
          `
        );
      }

      console.log(`✅ Account unfrozen successfully`);

      return {
        success: true,
        accountStatus: 'active',
        alertsResolved: activeAlerts.length
      };

    } catch (error) {
      console.error('❌ Account unfreeze error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create security alert
   */
  async createSecurityAlert(userId, alertType, severity, message, details = {}) {
    try {
      const alert = new SecurityAlert({
        userId,
        alertType,
        severity,
        message,
        details,
        actionsTaken: []
      });

      await alert.save();

      console.log(`📢 Security alert created: ${alert.alertId} (${severity})`);

      return alert;

    } catch (error) {
      console.error('❌ Create alert error:', error);
      throw error;
    }
  }

  /**
   * Check if account is frozen
   */
  async isAccountFrozen(userId) {
    const user = await User.findById(userId).select('accountStatus');
    return user && user.accountStatus === 'frozen';
  }

  /**
   * Get user's security alerts
   */
  async getUserSecurityAlerts(userId, limit = 10) {
    try {
      const alerts = await SecurityAlert.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);

      return {
        success: true,
        alerts
      };

    } catch (error) {
      console.error('❌ Get alerts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all active security alerts (Admin)
   */
  async getAllActiveAlerts(filter = {}) {
    try {
      const query = { status: 'ACTIVE', ...filter };
      
      const alerts = await SecurityAlert.find(query)
        .populate('userId', 'name email phoneNumber')
        .sort({ severity: -1, createdAt: -1 })
        .limit(100);

      return {
        success: true,
        count: alerts.length,
        alerts
      };

    } catch (error) {
      console.error('❌ Get all alerts error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Acknowledge alert (User)
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      const alert = await SecurityAlert.findOne({ alertId, userId });
      
      if (!alert) {
        throw new Error('Alert not found');
      }

      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      await alert.save();

      return {
        success: true,
        alert
      };

    } catch (error) {
      console.error('❌ Acknowledge alert error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default AccountSecurityService;
