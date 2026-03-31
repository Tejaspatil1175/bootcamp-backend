import mongoose from "mongoose";

const securityAlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  alertType: {
    type: String,
    enum: [
      'ACCOUNT_FROZEN',
      'SUSPICIOUS_TRANSACTION',
      'SIM_SWAP_DETECTED',
      'DEVICE_SWAP_DETECTED',
      'UNUSUAL_LOCATION',
      'HIGH_RISK_TRANSACTION',
      'DAILY_LIMIT_EXCEEDED',
      'MULTIPLE_FAILED_ATTEMPTS'
    ],
    required: true
  },
  
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  details: {
    transactionId: String,
    riskScore: Number,
    riskFactors: [String],
    additionalInfo: mongoose.Schema.Types.Mixed
  },
  
  // Actions taken
  actionsTaken: [{
    action: {
      type: String,
      enum: ['ACCOUNT_FROZEN', 'TRANSACTION_BLOCKED', 'NOTIFICATION_SENT', 'ADMIN_ALERTED']
    },
    timestamp: Date,
    performedBy: String
  }],
  
  // Alert status
  status: {
    type: String,
    enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
    default: 'ACTIVE'
  },
  
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: Date,
  
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  resolvedAt: Date,
  resolutionNotes: String
  
}, {
  timestamps: true
});

// Generate alert ID
securityAlertSchema.pre('validate', function(next) {
  if (!this.alertId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = Date.now().toString().slice(-6);
    this.alertId = `ALERT${year}${month}${day}${time}`;
  }
  next();
});

// Indexes
securityAlertSchema.index({ userId: 1, createdAt: -1 });
securityAlertSchema.index({ alertType: 1, status: 1 });
securityAlertSchema.index({ severity: 1 });

export default mongoose.model("SecurityAlert", securityAlertSchema);
