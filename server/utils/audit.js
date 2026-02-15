const mongoose = require('mongoose');

const AuditLog = require('../models/auditLog');

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

const redactKeyTerms = ['token', 'secret', 'password'];
const maskedValue = '[redacted]';

const shouldRedactKey = (key) => redactKeyTerms.some((term) => key.includes(term));
const isEmailKey = (key) => key.includes('email');
const isPhoneKey = (key) => key.includes('phone');

const maskMetadataValue = (value, keyHint) => {
  if (value == null) {
    return value;
  }
  const hint = keyHint ? String(keyHint).toLowerCase() : '';
  if (hint && shouldRedactKey(hint)) {
    return maskedValue;
  }
  if (hint && isEmailKey(hint)) {
    return maskEmail(value);
  }
  if (hint && isPhoneKey(hint)) {
    return maskPhone(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => maskMetadataValue(entry));
  }
  if (value instanceof Map) {
    return maskMetadataValue(Object.fromEntries(value.entries()), keyHint);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value && typeof value === 'object') {
    if (
      value.field
      && (Object.prototype.hasOwnProperty.call(value, 'before')
        || Object.prototype.hasOwnProperty.call(value, 'after'))
    ) {
      const fieldName = String(value.field).toLowerCase();
      return {
        ...value,
        before: maskValue(fieldName, value.before),
        after: maskValue(fieldName, value.after)
      };
    }
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = maskMetadataValue(value[key], key);
      return acc;
    }, {});
  }
  return value;
};

const sanitizeMetadata = (metadata) => {
  if (!metadata) {
    return undefined;
  }
  if (metadata instanceof Map) {
    return maskMetadataValue(Object.fromEntries(metadata.entries()));
  }
  if (metadata && typeof metadata === 'object') {
    return maskMetadataValue(metadata);
  }
  return maskMetadataValue({ value: metadata }).value;
};

const resolveActorUserId = (actorUserId) => {
  if (!actorUserId) {
    return null;
  }
  if (mongoose.isValidObjectId(actorUserId)) {
    return actorUserId;
  }
  if (actorUserId._id && mongoose.isValidObjectId(actorUserId._id)) {
    return actorUserId._id;
  }
  if (actorUserId.id && mongoose.isValidObjectId(actorUserId.id)) {
    return actorUserId.id;
  }
  return actorUserId;
};

const logAction = async ({ actorUserId, action, targetType, targetId, metadata, req }) => {
  const resolvedActorUserId = resolveActorUserId(actorUserId);
  if (!resolvedActorUserId) {
    throw new Error(`Audit log requires actorUserId for action "${action}".`);
  }

  const ipAddress = req?.ip || null;
  const userAgent = req?.get?.('user-agent') || null;

  return AuditLog.create({
    actorUserId: resolvedActorUserId,
    action,
    targetType: targetType || null,
    targetId: targetId || null,
    metadata: sanitizeMetadata(metadata),
    ipAddress,
    userAgent
  });
};

const logMemberUpdate = async ({ actorUser, memberId, before, after, req }) => {
  const changes = buildChangedFields(before, after);
  return logAction({
    actorUserId: actorUser,
    action: 'member.update',
    targetType: 'member',
    targetId: memberId,
    metadata: { changedFields: changes },
    req
  });
};

const logMemberChangeRequestDecision = async ({ actorUser, memberId, requestId, decision, note, req }) =>
  logAction({
    actorUserId: actorUser,
    action: `memberChangeRequest.${decision}`,
    targetType: 'memberChangeRequest',
    targetId: requestId,
    metadata: {
      memberId: memberId ? String(memberId) : null,
      note: note || null
    },
    req
  });

module.exports = {
  logAction,
  logMemberUpdate,
  logMemberChangeRequestDecision,
  maskEmail,
  maskPhone,
  maskMetadataValue,
  sanitizeMetadata
};
