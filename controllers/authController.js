import User from "../models/User.js";
import KYC from "../models/KYC.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { performNokiaVerification } from "./kycController.js";

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user profile
export const getProfile = async (req, res) => {
try {
const user = await User.findById(req.user.userId).select("-password");
if (!user) {
return res.status(404).json({ message: "User not found" });
}
res.json({ success: true, user });
} catch (error) {
res.status(500).json({ message: "Server error", error: error.message });
}
};

// Update user profile (name, UPI ID, phone number)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { upiId, phoneNumber, name } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Update name if provided
    if (name) {
      user.name = name;
    }

    // Update fields if provided
    if (upiId) {
      // Check if UPI ID is already taken
      const existingUPI = await User.findOne({ upiId, _id: { $ne: userId } });
      if (existingUPI) {
        return res.status(400).json({
          success: false,
          message: "UPI ID already in use"
        });
      }
      user.upiId = upiId;
    }

    if (phoneNumber) {
      // Check if phone number is already taken
      const existingPhone = await User.findOne({ phoneNumber, _id: { $ne: userId } });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use"
        });
      }
      user.phoneNumber = phoneNumber;
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId,
        phoneNumber: user.phoneNumber
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

// Update notification preferences
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationPreferences } = req.body;

    if (!notificationPreferences) {
      return res.status(400).json({
        success: false,
        message: "Notification preferences are required"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Merge preferences
    user.notificationPreferences = {
      email: {
        ...user.notificationPreferences.email,
        ...notificationPreferences.email
      },
      sms: {
        ...user.notificationPreferences.sms,
        ...notificationPreferences.sms
      },
      inApp: {
        ...user.notificationPreferences.inApp,
        ...notificationPreferences.inApp
      }
    };

    await user.save();

    res.json({
      success: true,
      message: "Notification preferences updated successfully",
      notificationPreferences: user.notificationPreferences
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Get user security alerts
export const getMySecurityAlerts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10, status } = req.query;

    const SecurityAlert = (await import('../models/SecurityAlert.js')).default;
    
    const filter = { userId };
    if (status) {
      filter.status = status.toUpperCase();
    }

    const alerts = await SecurityAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: alerts.length,
      alerts
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Acknowledge security alert
export const acknowledgeSecurityAlert = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { alertId } = req.params;

    const SecurityAlert = (await import('../models/SecurityAlert.js')).default;
    
    const alert = await SecurityAlert.findOne({ alertId, userId });
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found"
      });
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();
    
    await alert.save();

    res.json({
      success: true,
      message: "Alert acknowledged",
      alert
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};

// Register user with Nokia KYC
export const registerWithKYC = async (req, res) => {
  try {
    const { name, email, phoneNumber, latitude, longitude, password } = req.body;

    // Validation
    if (!name || !email || !phoneNumber) {
      return res.status(400).json({ 
        success: false,
        message: "Name, email, and phone number are required" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User with this email or phone number already exists" 
      });
    }

    // Generate a default password if not provided (for phone-only registration)
    const userPassword = password || `Temp${Math.random().toString(36).slice(-8)}!`;

    // Create new user
    const user = new User({
      name,
      email,
      phoneNumber,
      password: userPassword,
    });

    await user.save();

    // Create KYC record
    const kycRecord = new KYC({
      userId: user._id,
      phoneNumber,
      status: 'PENDING',
      location: {
        latitude: latitude || 19.160422047462603,
        longitude: longitude || 47.44178899529922
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
        registrationDate: new Date()
      }
    });

    await kycRecord.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES || '7d' }
    );

    // Start Nokia verification in background (don't wait for it)
    performNokiaVerification(kycRecord).catch(err => {
      console.error('Background Nokia verification error:', err);
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully. KYC verification in progress.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
      },
      kycStatus: {
        kycId: kycRecord.kycId,
        status: kycRecord.status
      }
    });
  } catch (error) {
    console.error('Registration with KYC error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};
