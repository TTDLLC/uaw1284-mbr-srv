const csrf = require('csurf');

const csrfProtection = csrf();

const CSRF_SKIP_RULES = [
  { method: 'GET', pattern: /^\/api\/health/ },
  { method: 'GET', pattern: /^\/api\/metrics/ }
];

const shouldSkipCsrf = (req) => CSRF_SKIP_RULES.some(({ method, pattern }) => {
  const methodMatches = method === '*' || method === req.method;
  const pathMatches = pattern.test(req.path);
  return methodMatches && pathMatches;
});

function protectRoutes(req, res, next) {
  if (shouldSkipCsrf(req)) {
    return next();
  }
  return csrfProtection(req, res, next);
}

const shouldAttachTokenToLocals = (req) => !req.path.startsWith('/api/');

function attachCsrfTokenToLocals(req, res, next) {
  if (typeof req.csrfToken === 'function' && shouldAttachTokenToLocals(req)) {
    res.locals.csrfToken = req.csrfToken();
  }
  res.locals.requestId = req.id;
  return next();
}

module.exports = {
  attachCsrfTokenToLocals,
  protectRoutes,
  shouldSkipCsrf
};
