const mongoose = require('mongoose');

const emailChangeRequestSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true
  },
  requestedEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  requestedAt: {
    type: Date,
    default: () => new Date(),
    index: true
  },
  reviewedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  note: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true
});

emailChangeRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.models.EmailChangeRequest
  || mongoose.model('EmailChangeRequest', emailChangeRequestSchema);
