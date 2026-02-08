const mongoose = require('mongoose');

const phoneVerificationSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  codeHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastSentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

phoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
phoneVerificationSchema.index({ memberId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.models.PhoneVerification
  || mongoose.model('PhoneVerification', phoneVerificationSchema);
