import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema({
  general: {
    companyName: {
      type: String,
      default: 'Loan Management System'
    },
    supportEmail: {
      type: String,
      default: 'support@loanapp.com'
    },
    supportPhone: {
      type: String,
      default: '+1-800-SUPPORT'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD'
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  loan: {
    defaultInterestRate: {
      type: Number,
      default: 12.5,
      min: 0,
      max: 100
    },
    maxLoanAmount: {
      type: Number,
      default: 1000000,
      min: 0
    },
    minCreditScore: {
      type: Number,
      default: 650,
      min: 300,
      max: 850
    },
    autoApprovalThreshold: {
      type: Number,
      default: 50000,
      min: 0
    }
  },
  notifications: {
    emailEnabled: {
      type: Boolean,
      default: true
    },
    smsEnabled: {
      type: Boolean,
      default: true
    },
    pushEnabled: {
      type: Boolean,
      default: true
    },
    adminNotifications: {
      type: Boolean,
      default: true
    }
  },
  security: {
    sessionTimeout: {
      type: Number,
      default: 30,
      min: 5,
      max: 480
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    },
    passwordExpiryDays: {
      type: Number,
      default: 90,
      min: 30,
      max: 365
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
export default SystemSettings;
