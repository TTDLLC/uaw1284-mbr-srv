const mongoose = require('mongoose');

const notificationRecipientSchema = new mongoose.Schema({
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['email', 'sms'],
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed', 'skipped'],
    default: 'queued',
    index: true
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

notificationRecipientSchema.index({ notificationId: 1, channel: 1 });
notificationRecipientSchema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.models.NotificationRecipient
  || mongoose.model('NotificationRecipient', notificationRecipientSchema);
