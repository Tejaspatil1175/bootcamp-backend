import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import TransactionFraudService from '../services/transactionFraudService.js';
import AccountSecurityService from '../services/accountSecurityService.js';
import NotificationService from '../services/notificationService.js';
import mongoose from 'mongoose';

const fraudService = new TransactionFraudService();
const securityService = new AccountSecurityService();
const notificationService = new NotificationService();

/**
 * Initiate a new transaction with real-time fraud check
 */
export const initiateTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, receiverUPI, receiverName, description, userLocation } = req.body;

    // Validate required fields
    if (!amount || !receiverUPI || !receiverName) {
      return res.status(400).json({
        success: false,
        message: 'Amount, receiver UPI, and receiver name are required'
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Server-side NFC/SIM/device swap enforcement: if Nokia reports sim/device swapped, block transactions
    try {
      const simSwapped = Boolean(
        user.simSwapDetection?.swapped ||
        user.nokiaVerification?.nokiaResults?.simSwapDetection?.swapped ||
        user.nokiaVerification?.nokaiResults?.simSwapDetection?.swapped
      );
      const deviceSwapped = Boolean(
        user.deviceSwapDetection?.swapped ||
        user.nokiaVerification?.nokiaResults?.deviceSwapDetection?.swapped ||
        user.nokiaVerification?.nokaiResults?.deviceSwapDetection?.swapped
      );

      if (simSwapped || deviceSwapped) {
        console.log(`🛑 Blocking transaction: simSwapped=${simSwapped} deviceSwapped=${deviceSwapped} for user ${userId}`);
        // Optionally mark account as frozen or flag for manual review here
        return res.status(403).json({
          success: false,
          message: simSwapped
            ? 'Transaction blocked: SIM swap detected on this account. Contact support.'
            : 'Transaction blocked: Device swap detected on this account. Contact support.',
          simSwapped,
          deviceSwapped
        });
      }
    } catch (e) {
      console.error('Error checking sim/device swap flags:', e);
    }

    // Check if account is frozen
    if (user.accountStatus === 'frozen') {
      return res.status(403).json({
        success: false,
        message: 'Your account is frozen. Please contact support.',
        accountStatus: 'frozen',
        reason: user.accountFrozenReason
      });
    }

    // Validate amount
    if (amount <= 0 || amount > 20000) {
      return res.status(400).json({
        success: false,
        message: 'Transaction amount must be between ₹1 and ₹20,000'
      });
    }

    // Check if user has UPI ID
    if (!user.upiId) {
      return res.status(400).json({
        success: false,
        message: 'Please set up your UPI ID first'
      });
    }

    console.log(`\n💸 ========== NEW TRANSACTION INITIATED ==========`);
    console.log(`👤 User: ${user.name}`);
    console.log(`💰 Amount: ₹${amount}`);
    console.log(`📤 To: ${receiverUPI}`);
    console.log(`=================================================\n`);

    // Create transaction record
    const transaction = new Transaction({
      userId,
      senderUPI: user.upiId,
      receiverUPI,
      receiverName,
      amount,
      description,
      status: 'processing',
      userLocation
    });

    await transaction.save();

    // Run real-time fraud check
    const fraudCheckResult = await fraudService.checkTransactionFraud(userId, {
      amount,
      receiverUPI,
      userLocation
    });

    // Update transaction with fraud check results
    transaction.fraudCheck = {
      performed: true,
      performedAt: new Date(),
      riskScore: fraudCheckResult.riskScore,
      riskLevel: fraudCheckResult.riskLevel,
      riskFactors: fraudCheckResult.riskFactors,
      recommendation: fraudCheckResult.recommendation,
      details: {
        numberVerification: fraudCheckResult.nokiaResults?.numberVerification || {},
        simSwapDetection: fraudCheckResult.nokiaResults?.simSwapDetection || {},
        deviceSwapDetection: fraudCheckResult.nokiaResults?.deviceSwapDetection || {},
        locationVerification: fraudCheckResult.nokiaResults?.locationVerification || {}
      },
      patternAnalysis: fraudCheckResult.patternAnalysis
    };

    // If Nokia's fraud check explicitly reports SIM swap or device swap, enforce block regardless of recommendation
    try {
      const simSwappedFromNokia = Boolean(fraudCheckResult.nokiaResults?.simSwapDetection?.swapped);
      const deviceSwappedFromNokia = Boolean(fraudCheckResult.nokiaResults?.deviceSwapDetection?.swapped);
      if (simSwappedFromNokia || deviceSwappedFromNokia) {
        console.log(`🛑 Nokia fraud check reported sim/device swap (sim:${simSwappedFromNokia} device:${deviceSwappedFromNokia}) — blocking transaction for user ${userId}`);

        // Mark transaction blocked and trigger account freeze
        transaction.status = 'blocked';
        transaction.triggeredAccountFreeze = true;

        user.fraudHistory.blockedTransactions += 1;
        user.fraudHistory.suspiciousActivities += 1;
        await user.save();

        const freezeResult = await securityService.freezeAccount(
          userId,
          `SIM/device swap detected by Nokia fraud check (Score: ${fraudCheckResult.riskScore}/100)`,
          transaction
        );

        // Notifications are handled by freezeAccount; preserve any existing notifications array
        const notifications = transaction.notificationsSent || [];
        transaction.notificationsSent = notifications;
        await transaction.save();

        return res.status(403).json({
          success: false,
          message: 'Transaction blocked: SIM/device swap detected. Your account has been frozen for security.',
          simSwapped: simSwappedFromNokia,
          deviceSwapped: deviceSwappedFromNokia
        });
      }
    } catch (e) {
      console.error('Error enforcing sim/device swap block after fraud check:', e);
    }

    // Process based on risk level
    let notifications = [];

    switch (fraudCheckResult.recommendation) {
      case 'ALLOW':
        // Low risk - complete transaction immediately
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        
        // Update user stats
        user.fraudHistory.totalTransactions += 1;
        await user.save();
        
        // Send success notification
        notifications = await notificationService.sendTransactionAlert(
          user,
          transaction,
          fraudCheckResult.riskLevel
        );
        
        console.log(`✅ Transaction ALLOWED - Low risk`);
        break;

      case 'WARN':
        // Medium risk - complete but send warning
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        
        user.fraudHistory.totalTransactions += 1;
        user.fraudHistory.suspiciousActivities += 1;
        await user.save();
        
        // Send warning notification
        notifications = await notificationService.sendTransactionAlert(
          user,
          transaction,
          fraudCheckResult.riskLevel
        );
        
        // Create security alert
        await securityService.createSecurityAlert(
          userId,
          'SUSPICIOUS_TRANSACTION',
          'MEDIUM',
          `Medium risk transaction of ₹${amount} completed`,
          {
            transactionId: transaction.transactionId,
            riskScore: fraudCheckResult.riskScore,
            riskFactors: fraudCheckResult.riskFactors
          }
        );
        
        console.log(`⚠️ Transaction ALLOWED with WARNING - Medium risk`);
        break;

      case 'BLOCK':
        // High/Critical risk - block transaction and freeze account
        transaction.status = 'blocked';
        transaction.triggeredAccountFreeze = true;
        
        user.fraudHistory.blockedTransactions += 1;
        user.fraudHistory.suspiciousActivities += 1;
        await user.save();
        
        // Freeze account
        const freezeResult = await securityService.freezeAccount(
          userId,
          `Critical fraud risk detected (Score: ${fraudCheckResult.riskScore}/100)`,
          transaction
        );
        
        // Notifications already sent by freezeAccount
        notifications = transaction.notificationsSent || [];
        
        console.log(`🛑 Transaction BLOCKED - Account FROZEN`);
        break;

      default:
        transaction.status = 'pending';
        console.log(`❓ Transaction status: PENDING - Manual review required`);
    }

    // Save notifications to transaction
    transaction.notificationsSent = notifications;
    await transaction.save();

    // Prepare response based on status
    const response = {
      success: transaction.status !== 'blocked',
      transactionId: transaction.transactionId,
      status: transaction.status,
      amount: transaction.amount,
      receiverUPI: transaction.receiverUPI,
      fraudCheck: {
        riskScore: fraudCheckResult.riskScore,
        riskLevel: fraudCheckResult.riskLevel,
        riskFactors: fraudCheckResult.riskFactors,
        recommendation: fraudCheckResult.recommendation
      },
      notificationsSent: notifications.length
    };

    if (transaction.status === 'blocked') {
      response.message = '🛑 Transaction blocked due to high fraud risk. Your account has been frozen for security.';
      response.accountStatus = 'frozen';
      response.contactSupport = true;
      return res.status(403).json(response);
    } else if (transaction.status === 'completed') {
      response.message = '✅ Transaction completed successfully';
      response.completedAt = transaction.completedAt;
      return res.status(200).json(response);
    } else {
      response.message = 'Transaction is under review';
      return res.status(202).json(response);
    }

  } catch (error) {
    console.error('❌ Transaction initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Transaction failed',
      error: error.message
    });
  }
};

/**
 * Get user's transaction history
 */
export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, status } = req.query;

    const filter = { userId };
    if (status) {
      filter.status = status;
    }

    const transactions = await Transaction.find(filter)
      .select('-fraudCheck.details -notificationsSent')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
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
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

/**
 * Get single transaction details
 */
export const getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.userId;

    const transaction = await Transaction.findOne({
      $or: [
        { transactionId },
        { _id: mongoose.Types.ObjectId.isValid(transactionId) ? transactionId : null }
      ],
      userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      transaction
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
};

/**
 * Get transaction statistics
 */
export const getTransactionStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await Transaction.find({
      userId,
      createdAt: { $gte: today }
    });

    const todayTotal = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
    const user = await User.findById(userId).select('dailyTransactionLimit');

    res.json({
      success: true,
      stats: {
        byStatus: stats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        today: {
          count: todayTransactions.length,
          totalAmount: todayTotal,
          limit: user.dailyTransactionLimit,
          remaining: Math.max(0, user.dailyTransactionLimit - todayTotal)
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

/**
 * Cancel pending transaction
 */
export const cancelTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.userId;

    const transaction = await Transaction.findOne({
      transactionId,
      userId,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Pending transaction not found'
      });
    }

    transaction.status = 'cancelled';
    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      transactionId: transaction.transactionId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel transaction',
      error: error.message
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all flagged/blocked transactions (Admin)
 */
export const getFlaggedTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, severity } = req.query;

    const filter = {
      status: { $in: ['blocked', 'pending'] },
      'fraudCheck.performed': true
    };

    if (severity) {
      filter['fraudCheck.riskLevel'] = severity.toUpperCase();
    }

    const transactions = await Transaction.find(filter)
      .populate('userId', 'name email phoneNumber accountStatus')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
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
      message: 'Failed to fetch flagged transactions',
      error: error.message
    });
  }
};

/**
 * Review blocked transaction (Admin)
 */
export const reviewTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { decision, comments } = req.body;
    const adminId = req.admin.adminId;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Valid decision (approved/rejected) is required'
      });
    }

    const transaction = await Transaction.findOne({ transactionId });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'blocked') {
      return res.status(400).json({
        success: false,
        message: 'Only blocked transactions can be reviewed'
      });
    }

    // Update transaction
    transaction.adminReview = {
      reviewed: true,
      reviewedBy: adminId,
      reviewedAt: new Date(),
      decision,
      comments
    };

    if (decision === 'approved') {
      transaction.status = 'completed';
      transaction.completedAt = new Date();
    } else {
      transaction.status = 'rejected';
    }

    await transaction.save();

    res.json({
      success: true,
      message: `Transaction ${decision} successfully`,
      transaction: {
        transactionId: transaction.transactionId,
        status: transaction.status,
        adminReview: transaction.adminReview
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to review transaction',
      error: error.message
    });
  }
};

/**
 * Get transaction statistics for dashboard (Admin)
 */
export const getAdminTransactionStats = async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get high-risk transactions count
    const highRiskCount = await Transaction.countDocuments({
      'fraudCheck.riskLevel': { $in: ['HIGH', 'CRITICAL'] }
    });

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: today } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          blockedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        overall: stats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {}),
        highRisk: highRiskCount,
        today: todayStats[0] || { count: 0, totalAmount: 0, blockedCount: 0 }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
} 
