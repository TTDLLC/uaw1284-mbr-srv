const express = require('express');
const router = express.Router();

const config = require('../../config');

router.get('/', (req, res) => {
  const requestId = req.id || null;
  const startedAt = req.app.locals.startedAt || null;
  const redisStatus = req.app.locals.redisStatus || (config.isProduction ? 'unknown' : 'not-required');
  const mongoStatus = req.app.locals.mongoStatus || 'unknown';
  const twilioConfigured = Boolean(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN);

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
      mongo: mongoStatus,
      redis: redisStatus,
      twilioConfigured
    }
  });
});

module.exports = router;
