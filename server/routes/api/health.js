const express = require('express');
const router = express.Router();

const config = require('../../config');

router.get('/', (req, res) => {
  const requestId = req.id || null;
  const startedAt = req.app.locals.startedAt || null;
  const redisStatus = req.app.locals.redisStatus || (config.isProduction ? 'unknown' : 'not-required');

  res.json({
    ok: true,
    status: 'up',
    ts: new Date().toISOString(),
    requestId,
    env: config.NODE_ENV,
    version: config.APP_VERSION,
    uptime: process.uptime(),
    startedAt,
    services: {
      redis: redisStatus
    }
  });
});

module.exports = router;
