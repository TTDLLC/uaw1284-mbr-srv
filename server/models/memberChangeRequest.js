const mongoose = require('mongoose');

const allowedChangeKeys = ['firstName', 'lastName', 'phone', 'departmentId'];

const memberChangeRequestSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true
  },
  requestedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  changes: {
    type: Object,
    required: true,
    validate: {
      validator(value) {
        if (!value || typeof value !== 'object') {
          return false;
        }
        const keys = Object.keys(value);
        if (!keys.length) {
          return false;
        }
        return keys.every((key) => allowedChangeKeys.includes(key));
      },
      message: 'Invalid change request fields.'
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  submittedAt: {
    type: Date,
    default: () => new Date()
  },
  reviewedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  note: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

memberChangeRequestSchema.index({ status: 1, submittedAt: -1 });
memberChangeRequestSchema.index({ memberId: 1, submittedAt: -1 });

module.exports = mongoose.models.MemberChangeRequest
  || mongoose.model('MemberChangeRequest', memberChangeRequestSchema);
