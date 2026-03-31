import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter a name"]
  },
  email: {
    type: String,
    required: [true, "Please enter an email"],
    unique: true
  },
  password: {
  type: String,
  required: [true, "Please enter a password"],
  minlength: 6
  },
  
  // Account Status and Security
  accountStatus: {
  type: String,
  enum: ['active', 'frozen', 'suspended'],
  default: 'active'
  },
  
  accountFrozenAt: Date,
  accountFrozenReason: String,
  
  // UPI Details
  upiId: {
  type: String,
  unique: true,
  sparse: true // Allows null values
  },
  
  phoneNumber: {
  type: String,
  unique: true,
  sparse: true
  },
  
  // Notification Preferences
  notificationPreferences: {
  email: {
  transactionAlerts: { type: Boolean, default: true },
  securityAlerts: { type: Boolean, default: true },
  accountUpdates: { type: Boolean, default: true }
  },
  sms: {
  transactionAlerts: { type: Boolean, default: true },
  securityAlerts: { type: Boolean, default: true },
  accountUpdates: { type: Boolean, default: false }
  },
  inApp: {
  transactionAlerts: { type: Boolean, default: true },
  securityAlerts: { type: Boolean, default: true },
  accountUpdates: { type: Boolean, default: true }
  }
  },
  
  // Transaction Limits
  dailyTransactionLimit: {
  type: Number,
  default: 20000 // 20k INR
  },
  
  // Fraud History Tracking
  fraudHistory: {
  totalTransactions: { type: Number, default: 0 },
  blockedTransactions: { type: Number, default: 0 },
  suspiciousActivities: { type: Number, default: 0 },
  lastSuspiciousActivity: Date
  }
  
  }, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
