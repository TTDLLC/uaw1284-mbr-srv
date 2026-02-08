const mongoose = require('mongoose');

const authTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['magicLogin'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  usedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

authTokenSchema.index({ userId: 1, purpose: 1, usedAt: 1 });

module.exports = mongoose.models.AuthToken || mongoose.model('AuthToken', authTokenSchema);
