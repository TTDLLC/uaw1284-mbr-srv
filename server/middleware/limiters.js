const rateLimit = require('express-rate-limit');

const config = require('../config');

const buildLimiter = ({ windowMs, max, message }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const response = {
      ok: false,
      message: message || 'Too many requests, please try again later.',
      requestId: req.id
    };
    return res.status(429).json(response);
  }
});

const limiters = {
  general: buildLimiter({
    ...config.security.rateLimits.general,
    message: 'Too many requests from this IP.'
  }),
  login: buildLimiter({
    ...config.security.rateLimits.login,
    message: 'Too many login attempts. Please try again later.'
  }),
  passwordReset: buildLimiter({
    ...config.security.rateLimits.passwordReset,
    message: 'Too many password reset requests. Please wait before retrying.'
  }),
  adminAction: buildLimiter({
    ...config.security.rateLimits.adminAction,
    message: 'Rate limit exceeded for admin actions.'
  })
};

module.exports = limiters;
