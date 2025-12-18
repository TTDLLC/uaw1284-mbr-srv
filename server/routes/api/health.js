const express = require('express');
const router = express.Router();

const config = require('../../config');

function basePayload(req) {
  return {
    requestId: req.id || null,
    env: config.NODE_ENV,
    version: config.APP_VERSION,
    uptime: process.uptime(),
    startedAt: req.app.locals.startedAt || null,
    ts: new Date().toISOString()
  };
}

router.get('/', (req, res) => {
  const mongoStatus = req.app.locals.mongoStatus || 'unknown';
  return res.json({
    ok: true,
    status: 'up',
    ...basePayload(req),
    services: {
      mongo: mongoStatus
    }
  });
});

router.get('/live', (req, res) => {
  return res.json({
    ok: true,
    status: 'live',
    ...basePayload(req),
    services: {
      process: 'up'
    }
  });
});

router.get('/ready', (req, res) => {
  const mongoStatus = req.app.locals.mongoStatus || 'unknown';
  const services = {
    process: 'up',
    mongo: mongoStatus
  };
  const allReady = mongoStatus === 'ready';
  return res.status(allReady ? 200 : 503).json({
    ok: allReady,
    status: allReady ? 'ready' : 'degraded',
    ...basePayload(req),
    services
  });
});

module.exports = router;
