const { v4: uuidv4 } = require('uuid');

const buildLogPayload = (req, res, level) => ({
  ts: new Date().toISOString(),
  level,
  requestId: req.id || uuidv4(),
  method: req.method,
  route: req.originalUrl || req.url,
  statusCode: res.statusCode,
  userId: req.session?.user?.id || req.user?.id || null,
  auditActions: req.auditActions || []
});

function requestLogger(req, res, next) {
  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console.log(JSON.stringify(buildLogPayload(req, res, level)));
  });
  return next();
}

module.exports = requestLogger;
