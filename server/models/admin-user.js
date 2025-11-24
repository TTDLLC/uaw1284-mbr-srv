const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: String,
    email: { type: String, lowercase: true },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'steward', 'readonly'],
      default: 'admin'
    },
    canSendSms: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminUser', AdminUserSchema);
