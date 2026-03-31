import Application from "../models/Application.js";
import User from "../models/User.js";
import NokiaNetworkService from "../services/nokiaService.js";
import mongoose from 'mongoose';

const nokiaService = new NokiaNetworkService();

/**
 * Background Nokia Verification Helper
 * Runs Nokia fraud checks asynchronously without blocking application submission
 */
async function runNokiaVerification(applicationId, verificationData) {
  try {
    const { phoneNumber, latitude, longitude, loanAmount } = verificationData;

    // Fetch the application
    const application = await Application.findById(applicationId);
    if (!application) {
      throw new Error('Application not found');
    }

    console.log(`🔍 Starting background Nokia verification for application ${application.applicationId}`);

    // Run verification
    let verificationResult;
    
    if (nokiaService.isAvailable()) {
      verificationResult = await nokiaService.comprehensiveFraudCheck({
        phoneNumber,
        latitude,
        longitude,
        loanAmount
      });
    } else {
      // Use mock if API key not configured
      verificationResult = await nokiaService.mockComprehensiveFraudCheck({
        phoneNumber,
        latitude,
        longitude,
        loanAmount
      });
    }

    // Update application with verification results
    application.nokiaVerification = {
      verified: true,
      verifiedAt: new Date(),
      riskScore: verificationResult.riskScore,
      riskLevel: verificationResult.riskLevel,
      riskFactors: verificationResult.riskFactors,
      recommendation: verificationResult.recommendation,
      confidence: verificationResult.confidence,
      details: {
        numberVerification: {
          verified: verificationResult.nokiaResults?.numberVerification?.verified || false,
          confidence: verificationResult.nokiaResults?.numberVerification?.confidence || 0
        },
        simSwapDetection: {
          swapDetected: verificationResult.nokiaResults?.simSwapDetection?.swapDetected || false,
          lastSwapDate: verificationResult.nokiaResults?.simSwapDetection?.lastSwapDate,
          riskLevel: verificationResult.nokiaResults?.simSwapDetection?.riskLevel || 'UNKNOWN'
        },
        deviceSwapDetection: {
          swapDetected: verificationResult.nokiaResults?.deviceSwapDetection?.swapDetected || false,
          lastSwapDate: verificationResult.nokiaResults?.deviceSwapDetection?.lastSwapDate,
          riskLevel: verificationResult.nokiaResults?.deviceSwapDetection?.riskLevel || 'UNKNOWN'
        },
        locationVerification: {
          locationMatch: verificationResult.nokiaResults?.locationVerification?.locationMatch || false,
          distance: verificationResult.nokiaResults?.locationVerification?.distance
        }
      },
      rawResults: verificationResult.nokiaResults || {},
      error: verificationResult.success ? null : verificationResult.error
    };

    await application.save();

    console.log(`✅ Background Nokia verification completed for ${application.applicationId}`);
    console.log(`   Risk Score: ${verificationResult.riskScore}/100 (${verificationResult.riskLevel})`);
    console.log(`   Recommendation: ${verificationResult.recommendation}`);

  } catch (error) {
    console.error('❌ Background Nokia verification error:', error.message);
    
    // Update application with error status
    try {
      const application = await Application.findById(applicationId);
      if (application) {
        application.nokiaVerification = {
          verified: false,
          verifiedAt: new Date(),
          error: error.message,
          riskScore: null,
          riskLevel: 'UNKNOWN'
        };
        await application.save();
      }
    } catch (updateError) {
      console.error('Failed to update application with error status:', updateError.message);
    }
  }
}


// Submit loan application
export const submitApplication = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      loanAmount,
      loanType,
      purpose,
      fullName,
      phoneNumber,
      email,
      dateOfBirth,
      monthlyIncome,
      address
    } = req.body;

    // Validate required fields (basic presence)
    if (!loanAmount || !purpose || !fullName || !phoneNumber || !email || !dateOfBirth || !monthlyIncome || !address) {
      return res.status(400).json({ 
        success: false, 
        message: "All required fields must be filled"
      });
    }

    // Coerce numeric fields and validate ranges to avoid Mongoose validation errors
    const loanAmountNum = Number(loanAmount);
    const monthlyIncomeNum = Number(monthlyIncome);
    if (Number.isNaN(loanAmountNum) || loanAmountNum < 10000) {
      return res.status(400).json({ success: false, message: 'loanAmount must be a number >= 10000' });
    }
    if (Number.isNaN(monthlyIncomeNum) || monthlyIncomeNum < 15000) {
      return res.status(400).json({ success: false, message: 'monthlyIncome must be a number >= 15000' });
    }

    // Validate address shape minimally
    if (!address.street || !address.city || !address.state || !address.pincode) {
      return res.status(400).json({ success: false, message: 'address must include street, city, state and pincode' });
    }

    // Validate dateOfBirth parseability
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date' });
    }

    // Check if user already has a pending application
    const existingApplication = await Application.findOne({ 
      userId, 
      status: 'pending' 
    });
    
    if (existingApplication) {
      return res.status(400).json({ 
        success: false, 
        message: "You already have a pending application" 
      });
    }

    // Create new application (use coerced numeric values)
    const application = new Application({
      userId,
      loanAmount: loanAmountNum,
      loanType: loanType || 'personal',
      purpose,
      fullName,
      phoneNumber,
      email,
      dateOfBirth: dob,
      monthlyIncome: monthlyIncomeNum,
      address,
      status: 'pending'
    });

    try {
      await application.save();
    } catch (saveErr) {
      // If it's a Mongoose validation error, return 400 with details
      if (saveErr && saveErr.name === 'ValidationError') {
        const errors = Object.values(saveErr.errors || {}).map(e => e.message || e.properties?.message).filter(Boolean);
        return res.status(400).json({ success: false, message: 'Validation failed', errors });
      }
      // Otherwise rethrow to be handled by outer catch
      throw saveErr;
    }

    // Run Nokia verification in background (non-blocking)
    // Don't wait for it to complete - let application be submitted immediately
    runNokiaVerification(application._id, {
    phoneNumber,
    latitude: address.latitude,
    longitude: address.longitude,
    loanAmount
    }).catch(err => {
    console.error('Background Nokia verification failed:', err.message);
    });

    res.status(201).json({
    success: true,
    message: "Application submitted successfully. Verification in progress.",
    application: {
    applicationId: application.applicationId,
    loanAmount: application.loanAmount,
    status: application.status,
    submittedAt: application.createdAt
    }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get user's applications
export const getUserApplications = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const applications = await Application.find({ userId })
      .select('applicationId loanAmount loanType purpose status createdAt reviewedAt adminComments finalDecision')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: applications.length,
      applications
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get single application by ID
export const getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.userId;
    
    const application = await Application.findOne({ 
      applicationId, 
      userId 
    }).populate('reviewedBy', 'fullName');

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    res.json({
      success: true,
      application
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Admin: Get all applications
export const getAllApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    
    const filter = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { applicationId: { $regex: search, $options: 'i' } }
      ];
    }

    const applications = await Application.find(filter)
      .populate('userId', 'name email')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Application.countDocuments(filter);

    res.json({
      success: true,
      data: {
        applications,
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
      message: "Server error", 
      error: error.message 
    });
  }
};

// Admin: Get single application with full details
export const getApplicationDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const application = await Application.findOne({ applicationId })
      .populate('userId', 'name email createdAt')
      .populate('reviewedBy', 'fullName employeeId')
      .populate('finalDecision.decidedBy', 'fullName employeeId');

    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    res.json({
      success: true,
      application
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Admin: Update application status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { decision, reason, approvedAmount, comments } = req.body;
    const adminId = req.admin.adminId;

    // Validate decision
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid decision (approved/rejected) is required" 
      });
    }

    // Build safe filter: only query _id if it's a valid ObjectId
    const filter = mongoose.Types.ObjectId.isValid(applicationId)
      ? { $or: [{ _id: applicationId }, { applicationId: applicationId }] }
      : { applicationId: applicationId };

    const application = await Application.findOne(filter);
    
    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: "Application has already been processed" 
      });
    }

    // Update application
    application.status = decision;
    application.reviewedBy = adminId;
    application.reviewedAt = new Date();
    application.adminComments = comments;
    
    application.finalDecision = {
      decision,
      reason,
      approvedAmount: decision === 'approved' ? (approvedAmount || application.loanAmount) : null,
      decidedBy: adminId,
      decidedAt: new Date()
    };

    await application.save();

    // Populate admin details for response
    await application.populate('reviewedBy', 'fullName employeeId');

    res.json({
      success: true,
      message: `Application ${decision} successfully`,
      data: {
        application: {
          _id: application._id,
          applicationId: application.applicationId,
          status: application.status,
          finalDecision: application.finalDecision,
          reviewedBy: application.reviewedBy,
          reviewedAt: application.reviewedAt
        }
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Admin: Get application statistics
export const getApplicationStats = async (req, res) => {
  try {
    const stats = await Application.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$loanAmount' }
        }
      }
    ]);

    const totalApplications = await Application.countDocuments();
    const recentApplications = await Application.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      stats: {
        total: totalApplications,
        recent: recentApplications,
        byStatus: stats.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount
          };
          return acc;
        }, {})
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};
export const triggerNokiaVerification = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const filter = mongoose.Types.ObjectId.isValid(applicationId)
      ? { $or: [{ _id: applicationId }, { applicationId: applicationId }] }
      : { applicationId: applicationId };

    const application = await Application.findOne(filter);
    
    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    // Check if already verified recently (within last hour)
    if (application.nokiaVerification?.verifiedAt) {
      const hoursSinceVerification = (Date.now() - new Date(application.nokiaVerification.verifiedAt)) / (1000 * 60 * 60);
      
      if (hoursSinceVerification < 1) {
        return res.status(400).json({
          success: false,
          message: "Application was verified recently. Please wait before re-verifying.",
          lastVerified: application.nokiaVerification.verifiedAt
        });
      }
    }

    // Trigger verification
    const verificationData = {
      phoneNumber: application.phoneNumber,
      latitude: application.address?.latitude,
      longitude: application.address?.longitude,
      loanAmount: application.loanAmount
    };

    // Run verification synchronously for manual trigger
    let verificationResult;
    
    if (nokiaService.isAvailable()) {
      verificationResult = await nokiaService.comprehensiveFraudCheck(verificationData);
    } else {
      verificationResult = await nokiaService.mockComprehensiveFraudCheck(verificationData);
    }

    // Update application
    application.nokiaVerification = {
      verified: true,
      verifiedAt: new Date(),
      riskScore: verificationResult.riskScore,
      riskLevel: verificationResult.riskLevel,
      riskFactors: verificationResult.riskFactors,
      recommendation: verificationResult.recommendation,
      confidence: verificationResult.confidence,
      details: {
        numberVerification: {
          verified: verificationResult.nokiaResults?.numberVerification?.verified || false,
          confidence: verificationResult.nokiaResults?.numberVerification?.confidence || 0
        },
        simSwapDetection: {
          swapDetected: verificationResult.nokiaResults?.simSwapDetection?.swapDetected || false,
          lastSwapDate: verificationResult.nokiaResults?.simSwapDetection?.lastSwapDate,
          riskLevel: verificationResult.nokiaResults?.simSwapDetection?.riskLevel || 'UNKNOWN'
        },
        deviceSwapDetection: {
          swapDetected: verificationResult.nokiaResults?.deviceSwapDetection?.swapDetected || false,
          lastSwapDate: verificationResult.nokiaResults?.deviceSwapDetection?.lastSwapDate,
          riskLevel: verificationResult.nokiaResults?.deviceSwapDetection?.riskLevel || 'UNKNOWN'
        },
        locationVerification: {
          locationMatch: verificationResult.nokiaResults?.locationVerification?.locationMatch || false,
          distance: verificationResult.nokiaResults?.locationVerification?.distance
        }
      },
      rawResults: verificationResult.nokiaResults || {},
      error: verificationResult.success ? null : verificationResult.error
    };

    await application.save();

    res.json({
      success: true,
      message: "Nokia verification completed successfully",
      verification: {
        riskScore: verificationResult.riskScore,
        riskLevel: verificationResult.riskLevel,
        recommendation: verificationResult.recommendation,
        confidence: verificationResult.confidence,
        riskFactors: verificationResult.riskFactors,
        details: application.nokiaVerification.details,
        verifiedAt: application.nokiaVerification.verifiedAt
      }
    });

  } catch (error) {
    console.error('Manual Nokia verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Nokia verification failed", 
      error: error.message 
    });
  }
};

/**
 * Get Nokia verification status for an application
 */
export const getNokiaVerificationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const filter = mongoose.Types.ObjectId.isValid(applicationId)
      ? { $or: [{ _id: applicationId }, { applicationId: applicationId }] }
      : { applicationId: applicationId };

    const application = await Application.findOne(filter)
      .select('applicationId nokiaVerification phoneNumber loanAmount');
    
    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    if (!application.nokiaVerification || !application.nokiaVerification.verified) {
      return res.json({
        success: true,
        verified: false,
        message: "Nokia verification not yet completed or in progress"
      });
    }

    res.json({
      success: true,
      verified: true,
      verification: {
        applicationId: application.applicationId,
        phoneNumber: application.phoneNumber,
        loanAmount: application.loanAmount,
        riskScore: application.nokiaVerification.riskScore,
        riskLevel: application.nokiaVerification.riskLevel,
        recommendation: application.nokiaVerification.recommendation,
        confidence: application.nokiaVerification.confidence,
        riskFactors: application.nokiaVerification.riskFactors,
        details: application.nokiaVerification.details,
        verifiedAt: application.nokiaVerification.verifiedAt,
        error: application.nokiaVerification.error
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};
