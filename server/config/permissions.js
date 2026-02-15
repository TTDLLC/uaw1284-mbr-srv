const PERMISSIONS = Object.freeze({
  MEMBERS_READ: 'members.read',
  MEMBERS_WRITE: 'members.write',
  NOTIFICATIONS_SEND: 'notifications.send',
  NOTIFICATIONS_READ: 'notifications.read',
  LABELS_MANAGE: 'labels.manage',
  AUDIT_READ: 'audit.read',
  AUDIT_EXPORT: 'audit.export',
  CHANGE_REQUESTS_REVIEW: 'changeRequests.review',
  EMAIL_REQUESTS_REVIEW: 'emailRequests.review',
  USERS_MANAGE: 'users.manage'
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const rolePermissions = Object.freeze({
  member: [],
  rep: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.CHANGE_REQUESTS_REVIEW,
    PERMISSIONS.EMAIL_REQUESTS_REVIEW
  ],
  steward: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_WRITE,
    PERMISSIONS.CHANGE_REQUESTS_REVIEW,
    PERMISSIONS.EMAIL_REQUESTS_REVIEW,
    PERMISSIONS.LABELS_MANAGE
  ],
  officer: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_WRITE,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.LABELS_MANAGE,
    PERMISSIONS.CHANGE_REQUESTS_REVIEW,
    PERMISSIONS.EMAIL_REQUESTS_REVIEW,
    PERMISSIONS.AUDIT_READ
  ],
  benefitsAdmin: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_WRITE,
    PERMISSIONS.CHANGE_REQUESTS_REVIEW,
    PERMISSIONS.EMAIL_REQUESTS_REVIEW
  ],
  staff: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_WRITE,
    PERMISSIONS.NOTIFICATIONS_SEND,
    PERMISSIONS.NOTIFICATIONS_READ,
    PERMISSIONS.LABELS_MANAGE,
    PERMISSIONS.CHANGE_REQUESTS_REVIEW,
    PERMISSIONS.EMAIL_REQUESTS_REVIEW,
    PERMISSIONS.AUDIT_READ
  ],
  admin: [...ALL_PERMISSIONS]
});

const getRolePermissions = (role) => {
  if (!role) {
    return [];
  }
  const normalized = String(role);
  if (normalized === 'admin') {
    return [...ALL_PERMISSIONS];
  }
  return rolePermissions[normalized] ? [...rolePermissions[normalized]] : [];
};

const getEffectivePermissions = (user) => {
  if (!user) {
    return [];
  }
  const direct = Array.isArray(user.permissions) ? user.permissions : [];
  const combined = new Set([...getRolePermissions(user.role), ...direct]);
  return Array.from(combined);
};

const hasPermission = (user, permission) => {
  if (!user || !permission) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  const effective = getEffectivePermissions(user);
  return effective.includes(permission);
};

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  rolePermissions,
  getRolePermissions,
  getEffectivePermissions,
  hasPermission
};
