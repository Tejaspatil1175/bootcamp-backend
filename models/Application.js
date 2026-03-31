import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Basic Application Details
  loanAmount: {
    type: Number,
    required: true,
    min: 10000,
    max: 10000000
  },
  loanType: {
    type: String,
    enum: ['personal', 'business', 'home', 'vehicle'],
    default: 'personal'
  },
  purpose: {
    type: String,
    required: true
  },
  
  // Basic Personal Information
  fullName: { 
    type: String, 
    required: true 
  },
  phoneNumber: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  dateOfBirth: { 
    type: Date, 
    required: true 
  },
  monthlyIncome: { 
    type: Number, 
    required: true,
    min: 15000
  },
  
  // Address Information
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  
  // Application Status
  status: {
    type: String,
    enum: [
      'pending',
      'approved',
      'rejected'
    ],
    default: 'pending'
  },
  
  // Admin Actions
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  reviewedAt: Date,
  adminComments: String,
  
  // Final Decision
  finalDecision: {
  decision: { type: String, enum: ['approved', 'rejected'] },
  reason: String,
  approvedAmount: Number,
  decidedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Admin'
  },
  decidedAt: Date
  },
  
  // Nokia Network Verification Results
  nokiaVerification: {
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  riskScore: { type: Number, min: 0, max: 100 },
  riskLevel: {
  type: String,
  enum: ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN']
  },
  riskFactors: [String],
  recommendation: {
  type: String,
  enum: ['APPROVE', 'PROCEED_WITH_CAUTION', 'ADDITIONAL_VERIFICATION', 'MANUAL_REVIEW', 'REJECT']
  },
  confidence: Number,
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
  rawResults: mongoose.Schema.Types.Mixed,
  error: String
  }
}, {
  timestamps: true
});

// Generate application ID before saving
applicationSchema.pre('validate', function(next) {
  if (!this.applicationId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = Date.now().toString().slice(-4);
    this.applicationId = `APP_${year}${month}${day}_${time}`;
  }
  next();
});

// Index for better performance
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ applicationId: 1 });
applicationSchema.index({ phoneNumber: 1 });
applicationSchema.index({ createdAt: -1 });

export default mongoose.model("Application", applicationSchema);
