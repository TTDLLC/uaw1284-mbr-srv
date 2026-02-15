const rateLimit = require('express-rate-limit');

const config = require('../config');
const { maskPhone } = require('../utils/phone');

const isApiRequest = (req) => {
  const accept = req.get('accept') || '';
  const fullPath = req.originalUrl || req.baseUrl || req.path || '';
  return fullPath.startsWith('/api') || accept.includes('application/json');
};

const buildLimiter = ({ windowMs, max, message, onLimit }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    if (!isApiRequest(req) && typeof onLimit === 'function') {
      return onLimit(req, res, message);
    }
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
  otpSend: buildLimiter({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Too many attempts. Please wait a few minutes and try again.',
    onLimit: (req, res, message) => res.status(429).render('register/phone', {
      title: 'Register Phone',
      layout: 'layout',
      errors: [message],
      form: {
        cid: req.body?.cid || '',
        lastName: req.body?.lastName || '',
        phone: req.body?.phone || ''
      }
    })
  }),
  otpConfirm: buildLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many attempts. Please wait a few minutes and try again.',
    onLimit: (req, res, message) => {
      const maskedPhone = maskPhone(req?.session?.phoneReg?.phoneE164);
      return res.status(429).render('register/phone-verify', {
        title: 'Verify Phone',
        layout: 'layout',
        errors: [message],
        maskedPhone
      });
    }
  }),
  notificationCreate: buildLimiter({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: 'Too many notification requests. Please wait a few minutes and try again.',
    onLimit: (req, res, message) => {
      if (req.session) {
        req.session.notificationLimiterMessage = message;
      }
      return res.redirect('/portal/staff/notifications/new');
    }
  }),
  adminAction: buildLimiter({
    ...config.security.rateLimits.adminAction,
    message: 'Rate limit exceeded for admin actions.'
  }),
  resourceDownload: buildLimiter({
    windowMs: 10 * 60 * 1000,
    max: 60,
    message: 'Too many download attempts. Please try again later.'
  })
};

module.exports = limiters;
