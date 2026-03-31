import express from "express";
import {
submitApplication,
getUserApplications,
getApplicationById,
getAllApplications,
getApplicationDetails,
updateApplicationStatus,
getApplicationStats,
triggerNokiaVerification,
getNokiaVerificationStatus
} from "../controllers/applicationController.js";
import { authenticateUser, authenticateAdmin, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// User routes
router.post("/submit", authenticateUser, submitApplication);
router.get("/my-applications", authenticateUser, getUserApplications);
router.get("/my-application/:applicationId", authenticateUser, getApplicationById);

// Admin routes - Fixed path to match frontend expectations
router.get("/admin/all", 
  authenticateAdmin, 
  checkPermission('view_applications'), 
  getAllApplications
);

router.get("/admin/details/:applicationId", 
  authenticateAdmin, 
  checkPermission('view_applications'), 
  getApplicationDetails
);

router.put("/admin/update-status/:applicationId", 
  authenticateAdmin, 
  checkPermission('approve_loans'), 
  updateApplicationStatus
);

router.get("/admin/stats", 
authenticateAdmin,
checkPermission('view_reports'),
getApplicationStats
);

// Nokia Verification routes
router.post("/admin/verify-nokia/:applicationId",
authenticateAdmin,
checkPermission('approve_loans'),
triggerNokiaVerification
);

router.get("/admin/nokia-status/:applicationId",
authenticateAdmin,
checkPermission('view_applications'),
getNokiaVerificationStatus
);

// User can also check their own application's Nokia verification status
router.get("/nokia-status/:applicationId",
authenticateUser,
getNokiaVerificationStatus
);

export default router;
