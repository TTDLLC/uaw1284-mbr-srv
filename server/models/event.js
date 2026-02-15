const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  startAt: {
    type: Date,
    required: true
  },
  endAt: {
    type: Date
  },
  timezone: {
    type: String,
    default: 'America/Detroit',
    trim: true
  },
  visibility: {
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
  }],
  capacity: {
    type: Number
  },
  rsvpDeadlineAt: {
    type: Date
  },
  active: {
    type: Boolean,
    default: true
  },
  createdByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

eventSchema.index({ active: 1, startAt: 1 });
eventSchema.index({ visibility: 1, startAt: 1 });

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
