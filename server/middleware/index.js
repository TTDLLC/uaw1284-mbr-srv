const { v4: uuidv4 } = require('uuid');

const { captureException } = require('../monitoring/sentry');

function requestId(req, _res, next) {
  req.id = req.id || uuidv4();
  next();
}

function getLogger(req) {
  if (req.log) {
    return req.log;
  }
  const appLogger = req.app?.locals?.logger;
  if (appLogger && typeof appLogger.info === 'function') {
    return appLogger;
  }
  return console;
}

function wantsJson(req) {
  return req.xhr || (req.get('accept') || '').includes('application/json');
}

function jsonErrorResponse(res, { status, requestId, code = null, message, errors = null }) {
  const payload = {
    ok: false,
    error: {
      code,
      message,
      status
    },
    requestId
  };

  if (errors && errors.length > 0) {
    payload.errors = errors;
  }

  return res.status(status).json(payload);
}

function notFound(req, res, _next) {
  const requestId = req.id || uuidv4();
  req.id = requestId;
  const logger = getLogger(req);
  logger.warn({ requestId, method: req.method, url: req.originalUrl }, 'Route not found');

  if (wantsJson(req)) {
    return jsonErrorResponse(res, {
      status: 404,
      requestId,
      code: 'not_found',
      message: 'Not Found'
    });
  }

  return res
    .status(404)
    .render('404', { title: 'Not Found', layout: 'layout', requestId });
}

function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  const requestId = req.id || uuidv4();
  req.id = requestId;
  const logger = getLogger(req);

  if (err.code === 'EBADCSRFTOKEN') {
    status = 403;
  }

  const isServerError = status >= 500;
  const logMethod = isServerError ? 'error' : 'warn';

  if (typeof logger[logMethod] === 'function') {
    logger[logMethod]({ err, status, requestId }, 'Request failed');
  } else {
    logger.log(`[${requestId}] ${status} ${err.message}`);
  }

  const defaultMessage =
    status >= 500 ? 'An unexpected error occurred.' : 'Unable to complete the request.';
  let publicMessage = defaultMessage;

  if (err.code === 'EBADCSRFTOKEN') {
    publicMessage = 'Invalid or missing CSRF token.';
  } else if (err.expose && err.message) {
    publicMessage = err.message;
  }

  if (typeof captureException === 'function' && status >= 500) {
    captureException(err, (scope) => {
      scope.setTag('requestId', requestId);
      scope.setContext('request', {
        method: req.method,
        url: req.originalUrl || req.url,
        headers: {
          'user-agent': req.headers['user-agent']
        }
      });
      const user = req.user || req.session?.user;
      if (user) {
        scope.setUser({ id: user.id, email: user.email });
      }
    });
  }

  if (wantsJson(req)) {
    return jsonErrorResponse(res, {
      status,
      requestId,
      code: err.code || null,
      message: publicMessage,
      errors: err.details
    });
  }

  return res.status(status).render('500', {
    title: status >= 500 ? 'Server Error' : 'Request Error',
    layout: 'layout',
    msg: publicMessage,
    requestId
  });
}

module.exports = { requestId, notFound, errorHandler };
