const { logAction } = require('../utils/audit');

async function logEvent(entry) {
  return logAction({
    actorUserId: entry.actorUserId || entry.actor?.id || entry.actor?._id,
    action: entry.action,
    targetType: entry.targetType || entry.entityType,
    targetId: entry.targetId || entry.entityId,
    metadata: entry.metadata,
    req: entry.req
  });
}

async function logMemberChange({ actor, memberId, action, notes }) {
  return logAction({
    actorUserId: actor?.id || actor?._id,
    action,
    targetType: 'member',
    targetId: memberId,
    metadata: { notes }
  });
}

async function logDataExport({ actor, format, filter, count }) {
  return logAction({
    actorUserId: actor?.id || actor?._id,
    action: 'member.export',
    targetType: 'member',
    targetId: null,
    metadata: { format, filter, count }
  });
}

module.exports = {
  logDataExport,
  logEvent,
  logMemberChange
};
