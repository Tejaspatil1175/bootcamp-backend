import KYC from '../models/KYC.js';
import NokiaNetworkService from '../services/nokiaService.js';

const nokiaService = new NokiaNetworkService();

/**
 * Get KYC status by ID
 */
export const getKYCStatus = async (req, res) => {
  try {
    const { kycId } = req.params;

    const kyc = await KYC.findOne({ kycId });
    
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found'
      });
    }

    res.json({
      success: true,
      ...kyc.toObject()
    });

  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get user's KYC records
 */
export const getUserKYC = async (req, res) => {
  try {
    const userId = req.user.userId;

    const kycRecords = await KYC.find({ userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: kycRecords.length,
      records: kycRecords
    });

  } catch (error) {
    console.error('Get user KYC error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Retry Nokia verification for a KYC record
 */
export const retryKYCVerification = async (req, res) => {
  try {
    const { kycId } = req.params;
    const userId = req.user.userId;

    const kyc = await KYC.findOne({ kycId, userId });
    
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC record not found'
      });
    }

    // Update status to IN_PROGRESS
    kyc.status = 'IN_PROGRESS';
    await kyc.save();

    // Perform Nokia verification in background
    performNokiaVerification(kyc);

    res.json({
      success: true,
      message: 'Nokia verification retry initiated',
      kycId: kyc.kycId
    });

  } catch (error) {
    console.error('Retry KYC verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Perform Nokia verification (background process)
 * This function runs Nokia fraud checks and updates KYC record
 */
export const performNokiaVerification = async (kycRecord) => {
  try {
    console.log(`🔍 Starting Nokia verification for KYC: ${kycRecord.kycId}`);

    // Update status to IN_PROGRESS
    kycRecord.status = 'IN_PROGRESS';
    await kycRecord.save();

    // Prepare data for Nokia check
    const applicationData = {
      phoneNumber: kycRecord.phoneNumber,
      latitude: kycRecord.location?.latitude,
      longitude: kycRecord.location?.longitude,
      loanAmount: 0 // Not applicable for registration KYC
    };

    // Run comprehensive Nokia fraud check
    let nokiaResult;
    if (nokiaService.isAvailable()) {
      nokiaResult = await nokiaService.comprehensiveFraudCheck(applicationData);
    } else {
      console.warn('⚠️ Nokia service not available, using mock check');
      nokiaResult = await nokiaService.mockComprehensiveFraudCheck(applicationData);
    }

    // Update KYC record with Nokia results
    kycRecord.nokiaVerification = {
      riskScore: nokiaResult.riskScore,
      riskLevel: nokiaResult.riskLevel,
      riskFactors: nokiaResult.riskFactors,
      recommendation: nokiaResult.recommendation,
      nokiaResults: nokiaResult.nokiaResults,
      confidence: nokiaResult.confidence,
      timestamp: new Date()
    };

    // Determine final KYC status based on risk score
    if (nokiaResult.riskScore >= 50) {
      // High risk - flag for manual review
      kycRecord.status = 'FLAGGED';
      console.log(`🚨 KYC ${kycRecord.kycId} FLAGGED - Risk Score: ${nokiaResult.riskScore}`);
    } else {
      // Low risk - approve
      kycRecord.status = 'COMPLETED';
      console.log(`✅ KYC ${kycRecord.kycId} COMPLETED - Risk Score: ${nokiaResult.riskScore}`);
    }

    await kycRecord.save();

    console.log(`✅ Nokia verification completed for KYC: ${kycRecord.kycId}`);
    return nokiaResult;

  } catch (error) {
    console.error(`❌ Nokia verification failed for KYC ${kycRecord.kycId}:`, error);
    
    // Update KYC status to FAILED
    kycRecord.status = 'FAILED';
    kycRecord.nokiaVerification = {
      riskScore: 100,
      riskLevel: 'CRITICAL',
      riskFactors: ['Nokia verification failed: ' + error.message],
      recommendation: 'MANUAL_REVIEW',
      confidence: 0,
      timestamp: new Date()
    };
    await kycRecord.save();

    throw error;
  }
};
