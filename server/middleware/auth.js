const { hasPermission } = require('../config/permissions');

const roles = Object.freeze({
  admin: 'admin',
  member: 'member',
  readOnly: 'readOnly',
  staff: 'staff',
  rep: 'rep',
  steward: 'steward',
  officer: 'officer',
  benefitsAdmin: 'benefitsAdmin'
});

const roleHierarchy = Object.freeze({
  readOnly: 0,
  member: 1,
  rep: 2,
  steward: 2,
  officer: 2,
  benefitsAdmin: 2,
  staff: 3,
  admin: 4
});

function wantsJson(req) {
  const accept = (req.get('accept') || '').toLowerCase();
  return req.xhr || req.path.startsWith('/api/') || accept.includes('application/json');
}

function respondWithError(req, res, status, message) {
  if (wantsJson(req)) {
    return res.status(status).json({ ok: false, message, requestId: req.id });
  }

  const title = status === 401 ? 'Sign In Required' : 'Access Denied';
  return res.status(status).render('403', {
    title,
    layout: 'layout',
    requestId: req.id,
    msg: message
  });
}

function requireAuth(req, res, next) {
  const sessionUser = req.session?.user;
  const user = req.user || sessionUser;
  if (!user) {
    return respondWithError(req, res, 401, 'Authentication required.');
  }
  req.user = user;
  return next();
}

function requireRole(requiredRoles) {
  const allowedRoles = Array.isArray(requiredRoles)
    ? requiredRoles
    : (() => {
      const requiredRole = String(requiredRoles);
      if (Object.prototype.hasOwnProperty.call(roleHierarchy, requiredRole)) {
        const minRank = roleHierarchy[requiredRole];
        return Object.keys(roleHierarchy).filter((role) => roleHierarchy[role] >= minRank);
      }
      return [requiredRole];
    })();
  return (req, res, next) => {
    const user = req.user || req.session?.user;
    if (!user) {
      return respondWithError(req, res, 401, 'Authentication required.');
    }
    if (!allowedRoles.includes(user.role)) {
      return respondWithError(req, res, 403, 'Insufficient permissions.');
    }
    req.user = user;
    return next();
  };
}

function attachCurrentUser(req, res, next) {
  const sessionUser = req.session?.user || null;
  const resolvedUser = req.user || sessionUser || null;
  if (sessionUser && !req.user) {
    req.user = sessionUser;
  }
  res.locals.currentUser = sessionUser;
  res.locals.hasPermission = (permission) => hasPermission(resolvedUser, permission);
  next();
}

module.exports = {
  attachCurrentUser,
  hasPermission,
  requireAuth,
  requireRole,
  roles
};
