const client = require('prom-client');

const config = require('../config');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Time spent handling requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

const requestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const errorCounter = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Number of HTTP responses with status >= 500',
  labelNames: ['method', 'route'],
  registers: [register]
});

function resolveRoute(req) {
  if (req.route?.path) {
    return req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
  }
  if (req.originalUrl) {
    return req.originalUrl.split('?')[0];
  }
  return req.url;
}

function metricsMiddleware(req, res, next) {
  if (!config.monitoring.metrics.enabled) {
    return next();
  }

  const start = process.hrtime.bigint ? process.hrtime.bigint() : process.hrtime();

  res.on('finish', () => {
    const route = resolveRoute(req);
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    let durationSeconds;
    if (typeof start === 'bigint') {
      const diffNs = process.hrtime.bigint() - start;
      durationSeconds = Number(diffNs) / 1e9;
    } else {
      const diff = process.hrtime(start);
      durationSeconds = diff[0] + diff[1] / 1e9;
    }
    requestDuration.observe(labels, durationSeconds);
    requestCounter.inc(labels);
    if (res.statusCode >= 500) {
      errorCounter.inc({ method: req.method, route });
    }
  });

  return next();
}

async function metricsHandler(_req, res) {
  if (!config.monitoring.metrics.enabled) {
    return res.status(503).json({ ok: false, message: 'Metrics collection disabled.' });
  }
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  return res.send(metrics);
}

module.exports = {
  metricsHandler,
  metricsMiddleware,
  register
};
