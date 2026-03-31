import express from "express";
import {
register,
registerWithKYC,
login,
logout,
getProfile,
updateProfile,
updateNotificationPreferences,
getMySecurityAlerts,
acknowledgeSecurityAlert
} from "../controllers/authController.js";
import { isAuthenticated, authenticateUser, authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Auth routes
router.post("/register", register);
router.post("/register-with-kyc", registerWithKYC); // New route for registration with Nokia KYC
router.post("/login", login);
router.get("/logout", logout);
router.get("/me", isAuthenticated, getProfile);
router.get("/profile", authenticateUser, getProfile);

// Profile management
router.put("/profile", authenticate, updateProfile);
router.put("/notification-preferences", authenticate, updateNotificationPreferences);

// Security alerts
router.get("/security-alerts", authenticate, getMySecurityAlerts);
router.put("/security-alerts/:alertId/acknowledge", authenticate, acknowledgeSecurityAlert);

export default router;