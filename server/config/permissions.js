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
  USERS_MANAGE: 'users.manage',
  RESOURCES_READ: 'resources.read',
  RESOURCES_MANAGE: 'resources.manage'
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const rolePermissions = Object.freeze({
  member: [
    PERMISSIONS.RESOURCES_READ
  ],
  rep: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.RESOURCES_READ,
    PERMISSIONS.CHANGE_REQUESTS_REVIEW,
    PERMISSIONS.EMAIL_REQUESTS_REVIEW
  ],
  steward: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_WRITE,
    PERMISSIONS.RESOURCES_READ,
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
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.RESOURCES_READ
  ],
  benefitsAdmin: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_WRITE,
    PERMISSIONS.RESOURCES_READ,
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
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.RESOURCES_READ,
    PERMISSIONS.RESOURCES_MANAGE
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
