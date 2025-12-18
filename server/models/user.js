const mongoose = require('mongoose');

const roles = ['admin', 'staff', 'readOnly'];

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: roles,
    default: 'staff',
    index: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'invited'],
    default: 'active',
    index: true
  },
  lastLoginAt: {
    type: Date
  },
  lastPasswordChangeAt: {
    type: Date
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

userSchema.index({ lastName: 1, firstName: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
