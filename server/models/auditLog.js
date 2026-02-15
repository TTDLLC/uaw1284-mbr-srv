const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  targetType: {
    type: String,
    trim: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

const blockMutation = function (next) {
  next(new Error('Audit logs are append-only.'));
};

auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);
auditLogSchema.pre('remove', blockMutation);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
