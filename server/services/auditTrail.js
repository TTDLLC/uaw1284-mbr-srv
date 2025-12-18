const AuditLog = require('../models/auditLog');

async function logEvent(entry) {
  return AuditLog.create({
    ...entry,
    createdAt: entry.createdAt || new Date()
  });
}

async function logMemberChange({ actor, memberId, action, before, after, ipAddress, notes }) {
  return logEvent({
    action,
    entityType: 'member',
    entityId: memberId,
    before,
    after,
    metadata: { notes },
    actor,
    ipAddress
  });
}

async function logDataExport({ actor, format, filter, count, ipAddress }) {
  return logEvent({
    action: 'member.export',
    entityType: 'member',
    entityId: 'export',
    metadata: { format, filter, count },
    actor,
    ipAddress
  });
}

module.exports = {
  logDataExport,
  logEvent,
  logMemberChange
};
