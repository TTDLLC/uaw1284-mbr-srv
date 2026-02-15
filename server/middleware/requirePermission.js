const { hasPermission } = require('../config/permissions');
const models = require('../models');

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

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      let user = req.user || req.session?.user || null;
      if (!user && req.session?.userId) {
        user = await models.User.findById(req.session.userId).lean();
      } else if (user && !user.permissions && (user.id || user._id)) {
        user = await models.User.findById(user.id || user._id).lean();
      }

      if (!user) {
        return respondWithError(req, res, 401, 'Authentication required.');
      }
      if (!hasPermission(user, permission)) {
        return respondWithError(req, res, 403, 'Insufficient permissions.');
      }
      req.user = req.user || user;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = requirePermission;
