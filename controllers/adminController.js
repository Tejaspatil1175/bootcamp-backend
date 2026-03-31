import Admin from "../models/Admin.js";
import User from "../models/User.js";
import Application from "../models/Application.js";
import Transaction from "../models/Transaction.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import NokiaNetworkService from "../services/nokiaService.js";

// Admin login
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if account is locked
    if (admin.isLocked) {
      return res.status(423).json({ 
        success: false, 
        message: "Account is locked due to too many failed attempts. Try again later." 
      });
    }

    // Check password
    const isPasswordValid = await admin.matchPassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await admin.incLoginAttempts();
      return res.status(400).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Reset login attempts on successful login
    if (admin.loginAttempts > 0) {
      await Admin.updateOne(
        { _id: admin._id },
        { $unset: { loginAttempts: 1, lockUntil: 1 } }
      );
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
    { adminId: admin._id, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        department: admin.department,
        permissions: admin.permissions
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

// Register Super Admin (Initial setup)
export const registerSuperAdmin = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      employeeId,
      registrationKey
    } = req.body;

    // Check if registration key is provided (for security)
    const SUPER_ADMIN_KEY = process.env.SUPER_ADMIN_REGISTRATION_KEY || "SUPER_ADMIN_2024";
    if (!registrationKey || registrationKey !== SUPER_ADMIN_KEY) {
    return res.status(403).json({
    success: false,
    message: "Invalid registration key. Super admin registration is restricted."
    });
    }

    // Check if any super admin already exists (optional security measure)
    const existingSuperAdmin = await Admin.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Super admin already exists. Only one super admin is allowed." 
      });
    }

    // Validate required fields
    if (!username || !email || !password || !fullName || !employeeId) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required" 
      });
    }

    // Check if admin already exists with same email, username, or employeeId
    const existingAdmin = await Admin.findOne({ 
      $or: [{ email }, { username }, { employeeId }] 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Admin with this email, username, or employee ID already exists" 
      });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 8 characters long" 
      });
    }

    // Create super admin
    const superAdmin = new Admin({
      username,
      email,
      password,
      fullName,
      role: 'super_admin',
      department: 'it',
      employeeId,
      permissions: [
        'view_applications',
        'approve_loans', 
        'reject_loans',
        'manage_users',
        'view_reports',
        'export_data',
        'system_settings',
        'user_management'
      ],
      isActive: true
    });

    await superAdmin.save();

    // Generate JWT token for immediate login
    const token = jwt.sign(
    { adminId: superAdmin._id, role: superAdmin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
    );

    res.status(201).json({
      success: true,
      message: "Super admin registered successfully",
      token,
      admin: {
        id: superAdmin._id,
        username: superAdmin.username,
        email: superAdmin.email,
        fullName: superAdmin.fullName,
        role: superAdmin.role,
        department: superAdmin.department,
        employeeId: superAdmin.employeeId,
        permissions: superAdmin.permissions
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

// Create admin (super admin only)
export const createAdmin = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      fullName,
      role,
      department,
      employeeId,
      permissions
    } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ 
      $or: [{ email }, { username }, { employeeId }] 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Admin with this email, username, or employee ID already exists" 
      });
    }

    // Validate role and permissions
    const validRoles = ['admin', 'senior_admin', 'super_admin', 'loan_officer', 'risk_analyst'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid role specified" 
      });
    }

    // Create new admin
    const admin = new Admin({
      username,
      email,
      password,
      fullName,
      role: role || 'loan_officer',
      department: department || 'loans',
      employeeId,
      permissions: permissions || ['view_applications']
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        department: admin.department,
        employeeId: admin.employeeId,
        permissions: admin.permissions
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

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    // Get application counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const applicationCount = await Application.countDocuments({ userId: user._id });
        const pendingCount = await Application.countDocuments({ 
          userId: user._id, 
          status: 'pending' 
        });
        
        return {
          ...user.toObject(),
          stats: {
            totalApplications: applicationCount,
            pendingApplications: pendingCount
          }
        };
      })
    );

    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
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

// Get single user with applications
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

    const applications = await Application.find({ userId })
      .select('applicationId loanAmount loanType status createdAt reviewedAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        applications
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

// Admin dashboard stats
export const getDashboardStats = async (req, res) => {
try {
const totalUsers = await User.countDocuments();
const activeUsers = await User.countDocuments({ isActive: true });
const frozenUsers = await User.countDocuments({ accountStatus: 'frozen' });
    
const totalApplications = await Application.countDocuments();
const pendingApplications = await Application.countDocuments({ status: 'pending' });
const approvedApplications = await Application.countDocuments({ status: 'approved' });
const rejectedApplications = await Application.countDocuments({ status: 'rejected' });

// Recent users (last 30 days)
const recentUsers = await User.countDocuments({
createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});

// Total loan amount requested
const loanStats = await Application.aggregate([
{
$group: {
_id: '$status',
totalAmount: { $sum: '$loanAmount' },
count: { $sum: 1 }
}
}
]);

// Calculate total transaction volume and counts using Transaction model
const totalTransactionCount = await Transaction.countDocuments();

// Sum total volume (amount) of all transactions
const volumeAgg = await Transaction.aggregate([
  { $group: { _id: null, totalVolume: { $sum: '$amount' } } }
]);
const totalTransactionVolume = (volumeAgg[0] && volumeAgg[0].totalVolume) || 0;

// Count flagged transactions - heuristics: performed fraud check and riskScore >= 50 OR recommendation suggests action
const flaggedCount = await Transaction.countDocuments({
  'fraudCheck.performed': true,
  $or: [
    { 'fraudCheck.riskScore': { $gte: 50 } },
    { 'fraudCheck.recommendation': { $in: ['WARN', 'CONFIRM', 'BLOCK'] } }
  ]
});

// Count blocked transactions (expand definition to include recommendation='BLOCK' or admin review rejections)
const blockedCount = await Transaction.countDocuments({
  $or: [
    { status: 'blocked' },
    { 'fraudCheck.recommendation': 'BLOCK' },
    { 'adminReview.decision': 'rejected' }
  ]
});

// Compute risk distribution by aggregating fraudCheck.riskLevel for performed checks
const riskAgg = await Transaction.aggregate([
  { $match: { 'fraudCheck.performed': true, 'fraudCheck.riskLevel': { $exists: true, $ne: null } } },
  { $group: { _id: '$fraudCheck.riskLevel', count: { $sum: 1 } } }
]);

// Map raw risk levels to grouped categories
let lowRiskCount = 0;
let mediumRiskCount = 0;
let highRiskCount = 0;

for (const item of riskAgg) {
  const level = (item._id || '').toString().toUpperCase();
  const count = item.count || 0;
  if (['VERY_LOW', 'LOW'].includes(level)) {
    lowRiskCount += count;
  } else if (['MEDIUM'].includes(level)) {
    mediumRiskCount += count;
  } else if (['HIGH', 'CRITICAL'].includes(level)) {
    highRiskCount += count;
  } else {
    // treat UNKNOWN and others as low risk by default
    lowRiskCount += count;
  }
}

const totalRiskCount = lowRiskCount + mediumRiskCount + highRiskCount;
const riskDistribution = [
  { name: 'Low Risk', value: totalRiskCount > 0 ? Math.round((lowRiskCount / totalRiskCount) * 100) : 65, color: 'hsl(var(--success))' },
  { name: 'Medium Risk', value: totalRiskCount > 0 ? Math.round((mediumRiskCount / totalRiskCount) * 100) : 25, color: 'hsl(var(--warning))' },
  { name: 'High Risk', value: totalRiskCount > 0 ? Math.round((highRiskCount / totalRiskCount) * 100) : 10, color: 'hsl(var(--destructive))' },
];

res.json({
  success: true,
  data: {
    users: {
      total: totalUsers,
      active: activeUsers || totalUsers, // Fallback if no isActive field
      frozen: frozenUsers || 0,
      newThisMonth: recentUsers
    },
    applications: {
      total: totalApplications,
      pending: pendingApplications,
      approved: approvedApplications,
      rejected: rejectedApplications
    },
    transactions: {
      total: totalTransactionCount,
      totalVolume: totalTransactionVolume,
      flagged: flaggedCount,
      blocked: blockedCount
    },
    riskDistribution,
    security: {
      activeAlerts: 0, // Add actual alert count from SecurityAlert model
      criticalAlerts: 0, // Add actual critical alert count
      frozenAccounts: frozenUsers || 0
    }
  }
});

} catch (error) {
console.error('Dashboard stats error:', error);
res.status(500).json({
success: false,
message: "Server error",
error: error.message
});
}
};

// Get admin profile
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.adminId).select('-password');
    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        message: "Admin not found" 
      });
    }

    res.json({
      success: true,
      admin
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Admin: Verify arbitrary phone number using Nokia NAC (for debugging/verification)
export const verifyPhoneNumberAdmin = async (req, res) => {
  try {
    const phone = req.query.phone || req.body.phone;
    if (!phone) return res.status(400).json({ success: false, message: 'phone query param required' });

    const nokia = new NokiaNetworkService();
    const result = await nokia.verifyPhoneNumber(phone);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin phone verify error:', error.message || error);
    return res.status(500).json({ success: false, message: 'Verification failed', error: error.message || error });
  }
};
