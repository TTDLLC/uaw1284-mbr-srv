const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');

const config = require('../../config');
const models = require('../../models');
const limiters = require('../../middleware/limiters');
const { validateBody } = require('../../middleware/validation');
const { regenerateSessionId } = require('../../middleware/session');
const { hashPassword, verifyPassword } = require('../../services/passwords');
const { logAction } = require('../../utils/audit');

const router = express.Router();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

router.get('/csrf-token', (req, res) => {
  if (typeof req.csrfToken !== 'function') {
    return res.status(500).json({
      ok: false,
      message: 'CSRF token generation is unavailable.',
      requestId: req.id
    });
  }

  return res.json({
    ok: true,
    csrfToken: req.csrfToken(),
    requestId: req.id
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.')
});

const passwordResetRequestSchema = z.object({
  email: z.string().email()
});

const passwordResetConfirmSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6, 'Reset token is required.'),
  newPassword: z.string()
});

const unauthorizedResponse = (res, requestId) =>
  res.status(401).json({ ok: false, message: 'Invalid email or password.', requestId });

router.post('/login', limiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const user = await models.User.findOne({ email });

    if (!user) {
      return unauthorizedResponse(res, req.id);
    }

    if (user.status !== 'active') {
      await logAction({
        actorUserId: user._id,
        action: 'auth.login.failed',
        targetType: 'user',
        targetId: user._id,
        metadata: { reason: 'user_inactive' },
        req
      });
      return unauthorizedResponse(res, req.id);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      await logAction({
        actorUserId: user._id,
        action: 'auth.login.failed',
        targetType: 'user',
        targetId: user._id,
        metadata: { reason: 'invalid_password' },
        req
      });
      return unauthorizedResponse(res, req.id);
    }

    await regenerateSessionId(req);
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    req.session.user = { id: user.id, email: user.email, role: user.role, name: displayName };

    await models.User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    await logAction({
      actorUserId: user._id,
      action: 'auth.login.success',
      targetType: 'user',
      targetId: user._id,
      req
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      requestId: req.id
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) {
    return res.json({ ok: true, requestId: req.id });
  }
  const actor = req.session.user;
  req.session.destroy(async (err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('uaw1284.sid');
    if (actor) {
      await logAction({
        actorUserId: actor,
        action: 'auth.logout',
        targetType: 'user',
        targetId: actor.id,
        req
      });
    }
    return res.json({ ok: true, requestId: req.id });
  });
});

router.post(
  '/password-reset',
  limiters.passwordReset,
  validateBody(passwordResetRequestSchema),
  async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = await models.User.findOne({ email });
    let devToken;

    if (user && user.status === 'active') {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashResetToken(token);
      const ttlMinutes = config.security.passwordResetTokenTtlMinutes;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      await models.PasswordResetToken.create({
        userId: user._id,
        email: user.email,
        tokenHash,
        expiresAt,
        createdIp: req.ip,
        createdUserAgent: req.get('user-agent') || null
      });

      if (!config.isProd) {
        devToken = token;
      }

      await logAction({
        actorUserId: user._id,
        action: 'auth.password_reset.requested',
        targetType: 'user',
        targetId: user._id,
        req
      });
    }

    const response = {
      ok: true,
      message: 'If an account exists for that email, password reset instructions have been sent.',
      requestId: req.id
    };

    if (devToken) {
      response.devToken = devToken;
    }

    return res.json(response);
  }
);

router.post(
  '/password-reset/confirm',
  limiters.passwordReset,
  validateBody(passwordResetConfirmSchema),
  async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      const { token, newPassword } = req.body;
      const user = await models.User.findOne({ email });

      if (!user || user.status !== 'active') {
        return res.status(400).json({
          ok: false,
          message: 'Invalid or expired password reset token.',
          requestId: req.id
        });
      }

      const tokenHash = hashResetToken(token);
      const now = new Date();
      const resetToken = await models.PasswordResetToken.findOne({
        userId: user._id,
        email,
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: now }
      });

      if (!resetToken) {
        return res.status(400).json({
          ok: false,
          message: 'Invalid or expired password reset token.',
          requestId: req.id
        });
      }

      const newHash = await hashPassword(newPassword);
      user.passwordHash = newHash;
      user.lastPasswordChangeAt = now;
      await user.save();

      await models.PasswordResetToken.updateOne(
        { _id: resetToken._id },
        { $set: { usedAt: now } }
      );
      await models.PasswordResetToken.updateMany(
        { userId: user._id, usedAt: null, _id: { $ne: resetToken._id } },
        { $set: { usedAt: now } }
      );

      await logAction({
        actorUserId: user._id,
        action: 'auth.password_reset.completed',
        targetType: 'user',
        targetId: user._id,
        req
      });

      return res.json({
        ok: true,
        message: 'Password reset complete.',
        requestId: req.id
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
