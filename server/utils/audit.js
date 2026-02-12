const { logEvent } = require('../services/auditTrail');

const maskEmail = (email) => {
  if (!email) {
    return null;
  }
  const value = String(email).trim();
  const atIndex = value.indexOf('@');
  if (atIndex === -1) {
    return `${value.charAt(0)}***`;
  }
  const firstChar = value.charAt(0);
  const domain = value.slice(atIndex + 1);
  return `${firstChar}***@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) {
    return null;
  }
  const digits = String(phone).replace(/\D/g, '');
  const last4 = digits.slice(-4);
  if (!last4) {
    return '***-***-****';
  }
  return `***-***-${last4}`;
};

const maskValue = (field, value) => {
  if (value == null) {
    return value;
  }
  if (field === 'email') {
    return maskEmail(value);
  }
  if (field === 'phone') {
    return maskPhone(value);
  }
  return value;
};

const buildChangedFields = (before, after) => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes = [];
  keys.forEach((key) => {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    if (beforeValue !== afterValue) {
      changes.push({
        field: key,
        before: maskValue(key, beforeValue),
        after: maskValue(key, afterValue)
      });
    }
  });
  return changes;
};

const maskSnapshot = (snapshot) => {
  if (!snapshot) {
    return snapshot;
  }
  return Object.keys(snapshot).reduce((acc, key) => {
    acc[key] = maskValue(key, snapshot[key]);
    return acc;
  }, {});
};

const logMemberUpdate = async ({ actorUser, memberId, before, after, ipAddress }) => {
  const actor = actorUser
    ? {
      id: actorUser.id || actorUser._id?.toString(),
      email: actorUser.email,
      role: actorUser.role
    }
    : null;

  const changes = buildChangedFields(before, after);

  return logEvent({
    action: 'member.update',
    entityType: 'member',
    entityId: String(memberId),
    actor,
    before: maskSnapshot(before),
    after: maskSnapshot(after),
    metadata: { changedFields: changes },
    ipAddress
  });
};

module.exports = {
  logMemberUpdate
};
