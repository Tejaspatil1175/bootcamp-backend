import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  
  // User and Payment Details
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // UPI Payment Details
  senderUPI: {
    type: String,
    required: true
  },
  receiverUPI: {
    type: String,
    required: true
  },
  receiverName: {
    type: String,
    required: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 1,
    max: 20000 // Daily limit
  },
  
  description: {
    type: String,
    maxlength: 200
  },
  
  // Transaction Status
  status: {
    type: String,
    enum: [
      'pending',           // Initial state
      'processing',        // Fraud check in progress
      'awaiting_confirmation', // Medium risk - needs user confirmation
      'completed',         // Successfully completed
      'blocked',           // Blocked due to high/critical risk
      'cancelled',         // User cancelled
      'failed'            // Technical failure
    ],
    default: 'pending'
  },
  
  // Nokia Fraud Check Results
  fraudCheck: {
    performed: { type: Boolean, default: false },
    performedAt: Date,
    riskScore: { type: Number, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']
    },
    riskFactors: [String],
    recommendation: {
      type: String,
      enum: ['ALLOW', 'WARN', 'CONFIRM', 'BLOCK']
    },
    details: {
      numberVerification: {
        verified: Boolean,
        confidence: Number
      },
      simSwapDetection: {
        swapDetected: Boolean,
        lastSwapDate: String,
        riskLevel: String
      },
      deviceSwapDetection: {
        swapDetected: Boolean,
        lastSwapDate: String,
        riskLevel: String
      },
      locationVerification: {
        locationMatch: Boolean,
        distance: String
      }
    },
    patternAnalysis: {
      unusualAmount: Boolean,
      frequencyViolation: Boolean,
      newRecipient: Boolean,
      suspiciousHour: Boolean
    }
  },
  
  // Notifications Sent
  notificationsSent: [{
    type: {
      type: String,
      enum: ['SMS', 'EMAIL', 'IN_APP']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'failed', 'delivered']
    },
    message: String
  }],
  
  // Account Freeze Trigger
  triggeredAccountFreeze: {
    type: Boolean,
    default: false
  },
  
  // Admin Review (for blocked transactions)
  adminReview: {
    reviewed: { type: Boolean, default: false },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    reviewedAt: Date,
    decision: {
      type: String,
      enum: ['approved', 'rejected']
    },
    comments: String
  },
  
  // Timestamps
  initiatedAt: Date,
  completedAt: Date,
  
  // Location data (for fraud check)
  userLocation: {
    latitude: Number,
    longitude: Number,
    ipAddress: String
  }
  
}, {
  timestamps: true
});

// Generate transaction ID before saving
transactionSchema.pre('validate', function(next) {
  if (!this.transactionId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = Date.now().toString().slice(-6);
    this.transactionId = `TXN${year}${month}${day}${time}`;
  }
  if (!this.initiatedAt) {
    this.initiatedAt = new Date();
  }
  next();
});

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ 'fraudCheck.riskLevel': 1 });

export default mongoose.model("Transaction", transactionSchema);
