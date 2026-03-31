import express from "express";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import adminSecurityRoutes from "./routes/adminSecurityRoutes.js";
import kycRoutes from "./routes/kycRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

const app = express();

// Middleware
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";

app.use(
  cors({
    origin: (origin, callback) => {
      // If FRONTEND_URL is "*" or not defined, we reflect the origin to allow any URL with credentials
      if (frontendUrl === "*" || !origin) {
        callback(null, true);
      } else {
        // Otherwise, allow the specific FRONTEND_URL and localhost for development
        const allowedOrigins = [frontendUrl, "http://localhost:8081", "http://localhost:8080"];
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          // If you want it to be 100% open from any URL (as requested), use:
          callback(null, true);
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);
console.log(`🌐 CORS allowed from: ${frontendUrl === "*" ? "ANY URL" : frontendUrl}`);


app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/admin/security", adminSecurityRoutes);
app.use("/api/kyc", kycRoutes);

app.get("/", (req, res) => {
res.json({
message: "Welcome to Fraud Protection Payment API",
version: "2.0.0",
features: [
"Real-time payment fraud detection",
"Nokia Network as Code integration",
"Automatic account freeze on critical risk",
"Multi-channel notifications (SMS, Email)",
"Transaction pattern analysis"
],
endpoints: {
user: {
register: "POST /api/auth/register",
login: "POST /api/auth/login",
profile: "GET /api/auth/profile",
updateProfile: "PUT /api/auth/profile",
updateNotifications: "PUT /api/auth/notification-preferences",
securityAlerts: "GET /api/auth/security-alerts",
acknowledgeAlert: "PUT /api/auth/security-alerts/:alertId/acknowledge",
// Transactions
initiatePayment: "POST /api/transactions/initiate",
transactionHistory: "GET /api/transactions/history",
transactionDetails: "GET /api/transactions/:transactionId",
transactionStats: "GET /api/transactions/stats/user",
cancelTransaction: "POST /api/transactions/:transactionId/cancel",
// Loan Applications
submitApplication: "POST /api/applications/submit",
myApplications: "GET /api/applications/my-applications"
},
admin: {
login: "POST /api/admin/login",
dashboard: "GET /api/admin/dashboard/stats",
// Transactions
flaggedTransactions: "GET /api/transactions/admin/flagged",
reviewTransaction: "PUT /api/transactions/admin/:transactionId/review",
transactionStats: "GET /api/transactions/admin/stats",
// Security
securityAlerts: "GET /api/admin/security/security-alerts",
frozenAccounts: "GET /api/admin/security/frozen-accounts",
unfreezeAccount: "POST /api/admin/security/unfreeze-account/:userId",
resolveAlert: "PUT /api/admin/security/security-alerts/:alertId/resolve",
// Applications
allApplications: "GET /api/applications/admin/all",
users: "GET /api/admin/users"
}
}
});
});

// Error handler
app.use(errorHandler);

export default app;
