function requireAuth(req, res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    return res.status(401).json({ ok: false, message: 'Authentication required.', requestId: req.id });
  }
  req.user = sessionUser;
  return next();
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ ok: false, message: 'Authentication required.', requestId: req.id });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ ok: false, message: 'Insufficient permissions.', requestId: req.id });
    }
    req.user = user;
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
