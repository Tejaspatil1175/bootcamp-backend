import NokiaNetworkService from './nokiaService.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

/**
 * Transaction Fraud Detection Service
 * Combines Nokia NAC APIs with behavioral pattern analysis
 */
class TransactionFraudService {
  constructor() {
    this.nokiaService = new NokiaNetworkService();
  }

  /**
   * Comprehensive fraud check for transactions
   */
  async checkTransactionFraud(userId, transactionData) {
    const { amount, receiverUPI, userLocation } = transactionData;
    
    try {
      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      console.log(`\n🔍 ========== TRANSACTION FRAUD CHECK ==========`);
      console.log(`👤 User: ${user.name} (${user.email})`);
      console.log(`📱 Phone: ${user.phoneNumber}`);
      console.log(`💰 Amount: ₹${amount}`);
      console.log(`📤 To: ${receiverUPI}`);
      console.log(`================================================\n`);

      // 1. Run Nokia API fraud checks (if phone number available)
      let nokiaResults = null;
      if (user.phoneNumber) {
        nokiaResults = await this.nokiaService.comprehensiveFraudCheck({
          phoneNumber: user.phoneNumber,
          latitude: userLocation?.latitude,
          longitude: userLocation?.longitude,
          loanAmount: amount
        });
      } else {
        console.warn('⚠️ No phone number - skipping Nokia checks');
        nokiaResults = {
          success: false,
          riskScore: 30,
          riskLevel: 'MEDIUM',
          riskFactors: ['Phone number not available for verification'],
          recommendation: 'MANUAL_REVIEW'
        };
      }

      // 2. Analyze transaction patterns
      const patternAnalysis = await this.analyzeTransactionPatterns(userId, transactionData);

      // 3. Calculate combined risk score
      const combinedRisk = this.calculateCombinedRisk(
        nokiaResults,
        patternAnalysis,
        amount,
        user
      );

      console.log(`\n📊 ========== FRAUD CHECK COMPLETE ==========`);
      console.log(`🎯 Final Risk Score: ${combinedRisk.riskScore}/100`);
      console.log(`⚠️ Risk Level: ${combinedRisk.riskLevel}`);
      console.log(`📋 Recommendation: ${combinedRisk.recommendation}`);
      console.log(`===========================================\n`);

      return {
        success: true,
        riskScore: combinedRisk.riskScore,
        riskLevel: combinedRisk.riskLevel,
        riskFactors: combinedRisk.riskFactors,
        recommendation: combinedRisk.recommendation,
        nokiaResults: nokiaResults?.nokiaResults || null,
        patternAnalysis
      };

    } catch (error) {
      console.error('❌ Transaction fraud check error:', error);
      return {
        success: false,
        riskScore: 100,
        riskLevel: 'CRITICAL',
        riskFactors: ['Fraud check system error'],
        recommendation: 'BLOCK',
        error: error.message
      };
    }
  }

  /**
   * Analyze transaction patterns for behavioral fraud detection
   */
  async analyzeTransactionPatterns(userId, transactionData) {
    const { amount, receiverUPI } = transactionData;
    const patterns = {
      unusualAmount: false,
      frequencyViolation: false,
      newRecipient: false,
      suspiciousHour: false,
      dailyLimitViolation: false
    };

    try {
      // Get user's transaction history (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userTransactions = await Transaction.find({
        userId,
        createdAt: { $gte: thirtyDaysAgo },
        status: { $in: ['completed', 'processing', 'pending'] }
      }).sort({ createdAt: -1 });

      console.log(`📊 Pattern Analysis: Found ${userTransactions.length} transactions in last 30 days`);

      // 1. Check for unusual amount
      if (userTransactions.length > 0) {
        const amounts = userTransactions.map(t => t.amount);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const maxPrevious = Math.max(...amounts);

        // Flag if amount is 3x average or 2x max previous
        if (amount > avgAmount * 3 || amount > maxPrevious * 2) {
          patterns.unusualAmount = true;
          console.log(`⚠️ Unusual amount: ₹${amount} (avg: ₹${avgAmount.toFixed(0)}, max: ₹${maxPrevious})`);
        }
      } else if (amount > 5000) {
        // First transaction and high amount
        patterns.unusualAmount = true;
        console.log(`⚠️ First transaction with high amount: ₹${amount}`);
      }

      // 2. Check frequency (velocity check)
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      
      const recentTransactions = userTransactions.filter(
        t => new Date(t.createdAt) > last24Hours
      );

      if (recentTransactions.length >= 5) {
        patterns.frequencyViolation = true;
        console.log(`⚠️ High frequency: ${recentTransactions.length} transactions in 24 hours`);
      }

      // 3. Check if new recipient
      const previousRecipients = userTransactions.map(t => t.receiverUPI);
      if (!previousRecipients.includes(receiverUPI)) {
        patterns.newRecipient = true;
        console.log(`ℹ️ New recipient: ${receiverUPI}`);
      }

      // 4. Check suspicious hours (11 PM - 5 AM)
      const currentHour = new Date().getHours();
      if (currentHour >= 23 || currentHour <= 5) {
        patterns.suspiciousHour = true;
        console.log(`⚠️ Suspicious hour: ${currentHour}:00`);
      }

      // 5. Check daily limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTransactions = userTransactions.filter(
        t => new Date(t.createdAt) >= today
      );
      
      const todayTotal = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
      const user = await User.findById(userId);
      
      if (todayTotal + amount > user.dailyTransactionLimit) {
        patterns.dailyLimitViolation = true;
        console.log(`⚠️ Daily limit exceeded: ₹${todayTotal + amount} / ₹${user.dailyTransactionLimit}`);
      }

      return patterns;

    } catch (error) {
      console.error('❌ Pattern analysis error:', error);
      return patterns;
    }
  }

  /**
   * Calculate combined risk score from Nokia results + pattern analysis
   */
  calculateCombinedRisk(nokiaResults, patternAnalysis, amount, user) {
    let riskScore = 0;
    const riskFactors = [];

    // 1. Nokia fraud check results (up to 70 points)
    if (nokiaResults && nokiaResults.success) {
      riskScore += Math.min(nokiaResults.riskScore * 0.7, 70);
      riskFactors.push(...nokiaResults.riskFactors);
    } else {
      riskScore += 20;
      riskFactors.push('⚠️ Nokia verification unavailable');
    }

    // 2. Pattern Analysis (up to 30 points)
    if (patternAnalysis.dailyLimitViolation) {
      riskScore += 15;
      riskFactors.push('🚨 Daily transaction limit exceeded');
    }

    if (patternAnalysis.unusualAmount) {
      riskScore += 8;
      riskFactors.push('⚠️ Unusual transaction amount detected');
    }

    if (patternAnalysis.frequencyViolation) {
      riskScore += 10;
      riskFactors.push('⚠️ High transaction frequency (velocity check failed)');
    }

    if (patternAnalysis.newRecipient && amount > 10000) {
      riskScore += 5;
      riskFactors.push('ℹ️ First time sending to this recipient with high amount');
    }

    if (patternAnalysis.suspiciousHour && amount > 5000) {
      riskScore += 7;
      riskFactors.push('⚠️ Transaction during unusual hours (11 PM - 5 AM)');
    }

    // 3. User fraud history
    if (user.fraudHistory?.blockedTransactions > 0) {
      riskScore += 10;
      riskFactors.push(`⚠️ Previous fraud history: ${user.fraudHistory.blockedTransactions} blocked transaction(s)`);
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level and recommendation
    let riskLevel, recommendation;

    if (riskScore >= 80) {
      riskLevel = 'CRITICAL';
      recommendation = 'BLOCK';
    } else if (riskScore >= 60) {
      riskLevel = 'HIGH';
      recommendation = 'BLOCK';
    } else if (riskScore >= 40) {
      riskLevel = 'MEDIUM';
      recommendation = 'WARN';
    } else if (riskScore >= 20) {
      riskLevel = 'LOW';
      recommendation = 'WARN';
    } else {
      riskLevel = 'VERY_LOW';
      recommendation = 'ALLOW';
    }

    return {
      riskScore: Math.round(riskScore),
      riskLevel,
      recommendation,
      riskFactors
    };
  }
}

export default TransactionFraudService;
