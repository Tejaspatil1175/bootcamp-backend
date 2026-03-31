import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

// Original user authentication middleware
export const isAuthenticated = async (req, res, next) => {
try {
const token = req.headers.authorization?.split(" ")[1] || req.cookies.token;

if (!token) {
return res.status(401).json({ message: "Please login to access this resource" });
}

const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded;
next();
} catch (error) {
return res.status(401).json({ message: "Token is invalid" });
}
};

// User authentication middleware
export const authenticateUser = async (req, res, next) => {
try {
// Support both 'Authorization' header and cookie-based token
const token = req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.token || req.headers.authorization?.split(" ")[1];
    
if (!token) {
return res.status(401).json({
success: false,
message: "No token, access denied"
});
}

// Use the canonical JWT secret from config: JWT_SECRET
const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
// Check if it's a user token
if (decoded.userId) {
const user = await User.findById(decoded.userId);
if (!user) {
return res.status(401).json({
success: false,
message: "Token is not valid"
});
}
req.user = { userId: decoded.userId };
next();
} else {
return res.status(401).json({
success: false,
message: "Invalid token format"
});
}
} catch (error) {
res.status(401).json({
success: false,
message: "Token is not valid"
});
}
};

// Admin authentication middleware
export const authenticateAdmin = async (req, res, next) => {
try {
const token = req.header("Authorization")?.replace("Bearer ", "");
    
if (!token) {
return res.status(401).json({
success: false,
message: "No token, access denied"
});
}

const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
// Check if it's an admin token
if (decoded.adminId) {
const admin = await Admin.findById(decoded.adminId);
if (!admin || !admin.isActive) {
return res.status(401).json({
success: false,
message: "Token is not valid or admin is inactive"
});
}
req.admin = {
adminId: decoded.adminId,
role: decoded.role
};
next();
} else {
return res.status(401).json({
success: false,
message: "Admin access required"
});
}
} catch (error) {
res.status(401).json({
success: false,
message: "Token is not valid"
});
}
};

// Check admin permissions middleware
export const checkPermission = (requiredPermission) => {
return async (req, res, next) => {
try {
const admin = await Admin.findById(req.admin.adminId);
      
if (!admin) {
return res.status(404).json({
success: false,
message: "Admin not found"
});
}

// Super admin has all permissions
if (admin.role === 'super_admin') {
return next();
}

// Check if admin has required permission
if (!admin.permissions.includes(requiredPermission)) {
return res.status(403).json({
success: false,
message: "Insufficient permissions"
});
}

next();
} catch (error) {
res.status(500).json({
success: false,
message: "Server error",
error: error.message
});
}
};
};

// Backwards-compatible alias used by some routes
export const authenticate = authenticateUser;
// Backwards-compatible admin alias
export const adminAuth = authenticateAdmin;