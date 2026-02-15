const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    index: true
  },
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true
  },
  readAt: {
    type: Date,
    default: () => new Date()
  }
}, {
  timestamps: true
});

announcementReadSchema.index({ memberId: 1, notificationId: 1 }, { unique: true });

module.exports = mongoose.models.AnnouncementRead
  || mongoose.model('AnnouncementRead', announcementReadSchema);
