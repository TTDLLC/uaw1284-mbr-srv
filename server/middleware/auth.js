const roles = Object.freeze({
  admin: 'admin',
  staff: 'staff',
  readOnly: 'readOnly'
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
  if (!sessionUser) {
    return respondWithError(req, res, 401, 'Authentication required.');
  }
  req.user = sessionUser;
  return next();
}

function requireRole(requiredRoles) {
  const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
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
  if (sessionUser && !req.user) {
    req.user = sessionUser;
  }
  res.locals.currentUser = sessionUser;
  next();
}

module.exports = {
  attachCurrentUser,
  requireAuth,
  requireRole,
  roles
};
