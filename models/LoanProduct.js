import mongoose from 'mongoose';

const loanProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['personal', 'business', 'education', 'home', 'vehicle']
  },
  minAmount: {
    type: Number,
    required: true,
    min: 0
  },
  maxAmount: {
    type: Number,
    required: true,
    min: 0
  },
  interestRate: {
    min: {
      type: Number,
      required: true,
      min: 0
    },
    max: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      required: true,
      enum: ['fixed', 'variable']
    }
  },
  tenure: {
    min: {
      type: Number,
      required: true,
      min: 1
    },
    max: {
      type: Number,
      required: true,
      min: 1
    }
  },
  eligibility: {
    minAge: {
      type: Number,
      required: true,
      min: 18
    },
    maxAge: {
      type: Number,
      required: true,
      max: 100
    },
    minIncome: {
      type: Number,
      required: true,
      min: 0
    },
    requiredDocuments: [{
      type: String,
      required: true
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const LoanProduct = mongoose.model('LoanProduct', loanProductSchema);
export default LoanProduct;
