const express = require('express');
const { z } = require('zod');

const limiters = require('../../middleware/limiters');
const { validateBody } = require('../../middleware/validation');
const { regenerateSessionId } = require('../../middleware/session');
const { hashPassword, verifyPassword } = require('../../services/passwords');
const demoUsers = require('../../services/demoUsers');
const { logEvent } = require('../../services/auditTrail');

const router = express.Router();

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

const passwordResetStore = new Map();

router.post('/login', limiters.login, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await demoUsers.findByEmail(email);
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
    const { email } = req.body;
    const user = await demoUsers.findByEmail(email);
    if (user) {
      passwordResetStore.set(user.email, { token: 'demo-token', requestedAt: Date.now() });
      await logEvent({
        action: 'auth.password_reset.requested',
        entityType: 'user',
        entityId: user.id,
        actor: { id: user.id, email: user.email, role: user.role },
        metadata: { token: 'demo-token' },
        ipAddress: req.ip
      });
    }
    return res.json({
      ok: true,
      message: 'If an account exists for that email, password reset instructions have been sent.',
      requestId: req.id
    });
  }
);

router.post(
  '/password-reset/confirm',
  limiters.passwordReset,
  validateBody(passwordResetConfirmSchema),
  async (req, res, next) => {
    try {
      const { email, token, newPassword } = req.body;
      const user = await demoUsers.findByEmail(email);
      const storedReset = passwordResetStore.get(email);

      if (!user || !storedReset || token !== storedReset.token) {
        return res.status(400).json({
          ok: false,
          message: 'Invalid or expired password reset token.',
          requestId: req.id
        });
      }

      const newHash = await hashPassword(newPassword);
      passwordResetStore.set(email, { ...storedReset, completedAt: Date.now(), hash: newHash });

      await logEvent({
        action: 'auth.password_reset.completed',
        entityType: 'user',
        entityId: user.id,
        actor: { id: user.id, email: user.email, role: user.role },
        metadata: { token },
        ipAddress: req.ip
      });

      return res.json({
        ok: true,
        message: 'Password reset complete for demo user.',
        requestId: req.id
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
