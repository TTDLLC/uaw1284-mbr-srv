const mongoose = require('mongoose');

const eventRsvpSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  status: {
    type: String,
    enum: ['yes', 'no', 'maybe'],
    required: true
  },
  comment: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

eventRsvpSchema.index({ eventId: 1, memberId: 1 }, { unique: true });
eventRsvpSchema.index({ eventId: 1, status: 1 });

module.exports = mongoose.models.EventRsvp || mongoose.model('EventRsvp', eventRsvpSchema);
