const { v4: uuidv4 } = require('uuid');

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

function notFound(req, res, _next) {
  const requestId = req.id || uuidv4();
  req.id = requestId;
  const logger = getLogger(req);
  logger.warn({ requestId, method: req.method, url: req.originalUrl }, 'Route not found');

  if (wantsJson(req)) {
    return res.status(404).json({ ok: false, message: 'Not Found', requestId });
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

  if (wantsJson(req)) {
    return res.status(status).json({ ok: false, message: publicMessage, requestId });
  }

  return res.status(status).render('500', {
    title: status >= 500 ? 'Server Error' : 'Request Error',
    layout: 'layout',
    msg: publicMessage,
    requestId
  });
}

module.exports = { requestId, notFound, errorHandler };
