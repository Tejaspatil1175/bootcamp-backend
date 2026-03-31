import Application from "../models/Application.js";
import User from "../models/User.js";

/**
 * Get all loan applications with filters
 * GET /api/admin/applications
 */
export const getAllApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = '',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Search filter
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      filter.$or = [
        { userId: { $in: userIds } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const applications = await Application.find(filter)
      .populate('userId', 'name email phoneNumber')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Application.countDocuments(filter);

    const formattedApplications = applications.map(app => ({
      applicationId: app._id,
      userId: {
        userId: app.userId._id,
        name: app.userId.name,
        email: app.userId.email
      },
      fullName: app.fullName,
      email: app.email,
      phoneNumber: app.phoneNumber,
      loanAmount: app.loanAmount,
      loanType: app.loanType,
      purpose: app.purpose,
      monthlyIncome: app.monthlyIncome,
      status: app.status,
      decision: app.decision,
      address: app.address,
      nokiaVerification: app.nokiaVerification,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt
    }));

    res.json({
      success: true,
      data: {
        applications: formattedApplications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
      error: error.message
    });
  }
};

/**
 * Get single application details
 * GET /api/admin/applications/:applicationId
 */
export const getApplicationDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate('userId', 'name email phoneNumber upiId accountStatus');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }

    res.json({
      success: true,
      data: {
        applicationId: application._id,
        userId: application.userId,
        fullName: application.fullName,
        email: application.email,
        phoneNumber: application.phoneNumber,
        dateOfBirth: application.dateOfBirth,
        loanAmount: application.loanAmount,
        loanType: application.loanType,
        purpose: application.purpose,
        monthlyIncome: application.monthlyIncome,
        status: application.status,
        decision: application.decision,
        address: application.address,
        nokiaVerification: application.nokiaVerification,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt
      }
    });

  } catch (error) {
    console.error('Get application details error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch application details",
      error: error.message
    });
  }
};

/**
 * Update application status (approve/reject)
 * PUT /api/admin/applications/:applicationId/status
 */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { decision, reason, approvedAmount } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision. Must be 'approved' or 'rejected'"
      });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found"
      });
    }

    // Update application
    application.status = decision;
    application.decision = {
      decision,
      reason: reason || '',
      approvedAmount: decision === 'approved' ? (approvedAmount || application.loanAmount) : null,
      decidedBy: req.admin.adminId,
      decidedAt: new Date()
    };

    await application.save();

    res.json({
      success: true,
      message: `Application ${decision} successfully`,
      data: {
        applicationId: application._id,
        status: application.status,
        decision: application.decision
      }
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update application status",
      error: error.message
    });
  }
};

/**
 * Get application statistics
 * GET /api/admin/applications/stats
 */
export const getApplicationStats = async (req, res) => {
  try {
    const total = await Application.countDocuments();
    const pending = await Application.countDocuments({ status: 'pending' });
    const approved = await Application.countDocuments({ status: 'approved' });
    const rejected = await Application.countDocuments({ status: 'rejected' });
    const underReview = await Application.countDocuments({ status: 'under_review' });

    // Calculate total approved amount
    const approvedApps = await Application.find({ status: 'approved' });
    const totalApprovedAmount = approvedApps.reduce((sum, app) => {
      return sum + (app.decision?.approvedAmount || app.loanAmount);
    }, 0);

    // Average processing time (in days)
    const processedApps = await Application.find({
      status: { $in: ['approved', 'rejected'] },
      'decision.decidedAt': { $exists: true }
    });

    let totalProcessingTime = 0;
    processedApps.forEach(app => {
      const created = new Date(app.createdAt);
      const decided = new Date(app.decision.decidedAt);
      const diff = (decided - created) / (1000 * 60 * 60 * 24); // Convert to days
      totalProcessingTime += diff;
    });

    const averageProcessingTime = processedApps.length > 0 
      ? Math.round(totalProcessingTime / processedApps.length) 
      : 0;

    // Applications by loan type
    const loanTypeStats = await Application.aggregate([
      {
        $group: {
          _id: '$loanType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$loanAmount' }
        }
      }
    ]);

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const count = await Application.countDocuments({
        createdAt: { $gte: monthStart, $lt: monthEnd }
      });
      
      const approvedCount = await Application.countDocuments({
        createdAt: { $gte: monthStart, $lt: monthEnd },
        status: 'approved'
      });
      
      monthlyTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        total: count,
        approved: approvedCount
      });
    }

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        underReview,
        totalApprovedAmount,
        averageProcessingTime,
        loanTypeStats,
        monthlyTrend
      }
    });

  } catch (error) {
    console.error('Get application stats error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch application statistics",
      error: error.message
    });
  }
};

export default {
  getAllApplications,
  getApplicationDetails,
  updateApplicationStatus,
  getApplicationStats
};
