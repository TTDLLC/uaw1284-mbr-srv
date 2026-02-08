const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');

const config = require('../../config');
const models = require('../../models');
const limiters = require('../../middleware/limiters');
const { validateBody } = require('../../middleware/validation');
const { regenerateSessionId } = require('../../middleware/session');
const { hashPassword, verifyPassword } = require('../../services/passwords');
const { logEvent } = require('../../services/auditTrail');

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
      await logEvent({
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: email,
        metadata: { reason: 'user_not_found' },
        ipAddress: req.ip
      });
      return unauthorizedResponse(res, req.id);
    }

    if (user.status !== 'active') {
      await logEvent({
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        actor: { id: user.id, email: user.email, role: user.role },
        metadata: { reason: 'user_inactive' },
        ipAddress: req.ip
      });
      return unauthorizedResponse(res, req.id);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      await logEvent({
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        actor: { id: user.id, email: user.email, role: user.role },
        metadata: { reason: 'invalid_password' },
        ipAddress: req.ip
      });
      return unauthorizedResponse(res, req.id);
    }

    await regenerateSessionId(req);
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    req.session.user = { id: user.id, email: user.email, role: user.role, name: displayName };

    await models.User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    await logEvent({
      action: 'auth.login.success',
      entityType: 'user',
      entityId: user.id,
      actor: { id: user.id, email: user.email, role: user.role },
      ipAddress: req.ip
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
      await logEvent({
        action: 'auth.logout',
        entityType: 'user',
        entityId: actor.id,
        actor,
        ipAddress: req.ip
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

      await logEvent({
        action: 'auth.password_reset.requested',
        entityType: 'user',
        entityId: user.id,
        actor: { id: user.id, email: user.email, role: user.role },
        ipAddress: req.ip
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

      await logEvent({
        action: 'auth.password_reset.completed',
        entityType: 'user',
        entityId: user.id,
        actor: { id: user.id, email: user.email, role: user.role },
        ipAddress: req.ip
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
