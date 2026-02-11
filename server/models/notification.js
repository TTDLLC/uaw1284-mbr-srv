const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'both'],
    required: true
  },
  audienceType: {
    type: String,
    enum: ['all', 'departments'],
    required: true
  },
  departmentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  subject: {
    type: String,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'queued', 'sending', 'completed', 'failed'],
    default: 'draft',
    index: true
  },
  totalTargeted: {
    type: Number,
    default: 0
  },
  emailEligible: {
    type: Number,
    default: 0
  },
  smsEligible: {
    type: Number,
    default: 0
  },
  sent: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
