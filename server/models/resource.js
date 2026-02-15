const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  originalName: { type: String, trim: true },
  storedName: { type: String, trim: true },
  mimeType: { type: String, trim: true },
  size: { type: Number },
  path: { type: String, trim: true }
}, { _id: false });

const audienceSchema = new mongoose.Schema({
  scope: {
    type: String,
    enum: ['all', 'departments', 'labels', 'mixed'],
    default: 'all'
  },
  departmentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: []
  }],
  labelIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Label',
    default: []
  }]
}, { _id: false });

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['link', 'file'],
    required: true
  },
  url: {
    type: String,
    trim: true
  },
  file: {
    type: fileSchema
  },
  audience: {
    type: audienceSchema,
    default: () => ({})
  },
  active: {
    type: Boolean,
    default: true
  },
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

resourceSchema.index({ active: 1, createdAt: -1 });
resourceSchema.index({ 'audience.departmentIds': 1 });
resourceSchema.index({ 'audience.labelIds': 1 });

module.exports = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);
