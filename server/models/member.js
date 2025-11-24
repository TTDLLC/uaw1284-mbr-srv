const mongoose = require('mongoose');

const CommunicationLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    channel: {
      type: String,
      enum: ['sms', 'email', 'call', 'in-person', 'other'],
      default: 'other'
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      default: 'outbound'
    },
    subject: String,
    message: String,
    meta: {},
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' }
  },
  { _id: false }
);

const MemberSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  cid: { type: String, unique: true, sparse: true, index: true },
  uid: { type: String, unique: true, sparse: true, index: true },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  email: { type: String, lowercase: true, index: true },
  phone: { type: String, index: true },
  seniorityDate: { type: Date },
  status: {
    type: String,
    enum: ['HBU', 'SBU', 'TRA', 'INPRO'],
    default: 'HBU'
  },
  departmentNumber: String,
  departmentName: String,
  tags: { type: [String], default: [] },
  smsGroups: { type: [String], default: [] },
  internalNotes: { type: String },
  communicationLog: [CommunicationLogSchema]
});

MemberSchema.index({ lastName: 1, firstName: 1 });
MemberSchema.index({ smsGroups: 1 });
MemberSchema.index({ internalNotes: 'text', tags: 'text' });

module.exports = mongoose.model('Member', MemberSchema);
