const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'USA' }
}, { _id: false });

const memberSchema = new mongoose.Schema({
  cid: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  uid: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: addressSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: ['active', 'retired', 'left', 'pending'],
    default: 'active',
    index: true
  },
  joinDate: {
    type: Date
  },
  unit: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

memberSchema.index({ lastName: 1, firstName: 1 });
memberSchema.index({ unit: 1, status: 1 });

module.exports = mongoose.models.Member || mongoose.model('Member', memberSchema);
