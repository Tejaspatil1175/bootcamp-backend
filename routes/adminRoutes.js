import express from "express";
import {
  adminLogin,
  registerSuperAdmin,
  createAdmin,
  getAllUsers,
  getUserDetails,
  getDashboardStats,
  getAdminProfile
  ,verifyPhoneNumberAdmin
} from "../controllers/adminController.js";
import { authenticateAdmin, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin authentication
router.post("/login", adminLogin);

// Super Admin Registration (Initial setup - no authentication required)
router.post("/register-super-admin", registerSuperAdmin);

// Admin profile
router.get("/profile", authenticateAdmin, getAdminProfile);

// Admin: verify phone via Nokia NAC
router.get('/profile/verify-phone', authenticateAdmin, checkPermission('view_reports'), verifyPhoneNumberAdmin);

// Dashboard
router.get("/dashboard/stats", 
  authenticateAdmin, 
  checkPermission('view_reports'), 
  getDashboardStats
);

// User management
router.get("/users", 
  authenticateAdmin, 
  checkPermission('view_applications'), 
  getAllUsers
);

router.get("/users/:userId", 
  authenticateAdmin, 
  checkPermission('view_applications'), 
  getUserDetails
);

// Admin management (super admin only)
router.post("/create-admin", 
  authenticateAdmin, 
  checkPermission('user_management'), 
  createAdmin
);



export default router;
