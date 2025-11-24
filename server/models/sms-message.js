const mongoose = require('mongoose');

const SmsMessageSchema = new mongoose.Schema({
  to: String,
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  body: String,
  status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
  twilioSid: String,
  errorCode: String,
  errorMessage: String,
  segmentType: {
    type: String,
    enum: ['all-members', 'filter', 'sms-group', 'tags'],
    default: 'filter'
  },
  segmentFilterSummary: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SmsMessage', SmsMessageSchema);
