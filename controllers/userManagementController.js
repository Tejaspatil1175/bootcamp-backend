import User from "../models/User.js";
import Application from "../models/Application.js";
import Transaction from "../models/Transaction.js";
import SecurityAlert from "../models/SecurityAlert.js";

/**
 * Get all users with pagination and filters
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = '', 
      sortBy = 'createdAt',
      sortOrder = 'desc' 
    } = req.query;

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      filter.accountStatus = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await User.find(filter)
      .select('-password')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(filter);

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const applicationCount = await Application.countDocuments({ userId: user._id });
        const transactionCount = await Transaction.countDocuments({ userId: user._id });
        const alertCount = await SecurityAlert.countDocuments({ userId: user._id, status: 'OPEN' });

        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber || 'N/A',
          upiId: user.upiId || 'N/A',
          accountStatus: user.accountStatus || 'active',
          emailVerified: user.emailVerified || false,
          phoneVerified: user.phoneVerified || false,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt || null,
          accountFrozenAt: user.accountFrozenAt || null,
          accountFrozenReason: user.accountFrozenReason || null,
          stats: {
            totalApplications: applicationCount,
            totalTransactions: transactionCount,
            activeAlerts: alertCount
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message
    });
  }
};

/**
 * Get single user details
 * GET /api/admin/users/:userId
 */
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get user's applications
    const applications = await Application.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's transactions
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's security alerts
    const alerts = await SecurityAlert.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        user: {
          userId: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          upiId: user.upiId,
          accountStatus: user.accountStatus || 'active',
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          accountFrozenAt: user.accountFrozenAt,
          accountFrozenReason: user.accountFrozenReason
        },
        applications,
        transactions,
        alerts
      }
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message
    });
  }
};

/**
 * Update user account status
 * PUT /api/admin/users/:userId/status
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['active', 'frozen', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.accountStatus = status;
    if (status === 'frozen' || status === 'suspended') {
      user.accountFrozenAt = new Date();
      user.accountFrozenReason = reason || 'Administrative action';
    } else {
      user.accountFrozenAt = null;
      user.accountFrozenReason = null;
    }

    await user.save();

    res.json({
      success: true,
      message: `User account ${status} successfully`,
      data: {
        userId: user._id,
        accountStatus: user.accountStatus
      }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
      error: error.message
    });
  }
};

/**
 * Get user statistics
 * GET /api/admin/users/stats
 */
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ accountStatus: 'active' });
    const frozenUsers = await User.countDocuments({ accountStatus: 'frozen' });
    const suspendedUsers = await User.countDocuments({ accountStatus: 'suspended' });
    
    const verifiedEmailUsers = await User.countDocuments({ emailVerified: true });
    const verifiedPhoneUsers = await User.countDocuments({ phoneVerified: true });

    // New users this month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await User.countDocuments({
      createdAt: { $gte: firstDayOfMonth }
    });

    // Growth trend (last 6 months)
    const growthTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      
      const count = await User.countDocuments({
        createdAt: { $gte: monthStart, $lt: monthEnd }
      });
      
      growthTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        count
      });
    }

    res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        frozen: frozenUsers,
        suspended: suspendedUsers,
        verifiedEmail: verifiedEmailUsers,
        verifiedPhone: verifiedPhoneUsers,
        newThisMonth,
        growthTrend
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user statistics",
      error: error.message
    });
  }
};

export default {
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getUserStats
};
