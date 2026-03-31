import mongoose from "mongoose";
import bcrypt from "bcrypt";

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Please enter a username"],
    unique: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: [true, "Please enter an email"],
    unique: true
  },
  password: {
    type: String,
    required: [true, "Please enter a password"],
    minlength: 8
  },
  fullName: {
    type: String,
    required: [true, "Please enter full name"]
  },
  role: {
    type: String,
    enum: ['admin', 'senior_admin', 'super_admin', 'loan_officer', 'risk_analyst'],
    default: 'loan_officer'
  },
  department: {
    type: String,
    enum: ['loans', 'risk_management', 'compliance', 'operations', 'it'],
    default: 'loans'
  },
  permissions: [{
    type: String,
    enum: [
      'view_applications',
      'approve_loans', 
      'reject_loans',
      'manage_users',
      'view_reports',
      'export_data',
      'system_settings',
      'user_management'
    ]
  }],
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  branchCode: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginAttempts: { 
    type: Number, 
    default: 0 
  },
  lockUntil: Date
}, { timestamps: true });

// Hash password before saving
adminSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Check if account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Increment login attempts
adminSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { loginAttempts: 1, lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 3 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 4 * 60 * 60 * 1000 }; // 4 hours
  }
  return this.updateOne(updates);
};

// Compare password
adminSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("Admin", adminSchema);
