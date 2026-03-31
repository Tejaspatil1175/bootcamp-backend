import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  kycId: {
    type: String,
    required: true,
    unique: true,
    default: () => `KYC${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'FLAGGED'],
    default: 'PENDING'
  },
  nokiaVerification: {
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, default: 'UNKNOWN' },
    riskFactors: [String],
    recommendation: { type: String, default: 'PENDING' },
    nokiaResults: {
      numberVerification: mongoose.Schema.Types.Mixed,
      simSwapDetection: mongoose.Schema.Types.Mixed,
      deviceSwapDetection: mongoose.Schema.Types.Mixed,
      locationVerification: mongoose.Schema.Types.Mixed
    },
    confidence: { type: Number, default: 0 },
    timestamp: Date
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    registrationDate: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
kycSchema.index({ userId: 1 });
kycSchema.index({ kycId: 1 });
kycSchema.index({ status: 1 });

const KYC = mongoose.model('KYC', kycSchema);

export default KYC;
