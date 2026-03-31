import mongoose from "mongoose";
import Admin from "./models/Admin.js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
const envPath = path.resolve(process.cwd(), "config", "config.env");
dotenv.config({ path: envPath });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

// Create default admin (DISABLED - Use /admin/register-super-admin endpoint instead)
const createDefaultAdmin = async () => {
  console.log("Default admin creation is disabled.");
  console.log("Use POST /api/admin/register-super-admin to create your first super admin.");
  console.log("Refer to SUPERADMIN_API.md for detailed instructions.");
};
// const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "http://localhost:4000";
// const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "12345678";

// Run setup
const runSetup = async () => {
  await connectDB();
  await createDefaultAdmin();
  process.exit(0);
};

runSetup();
