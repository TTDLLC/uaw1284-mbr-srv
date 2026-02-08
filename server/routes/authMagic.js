const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');

const config = require('../config');
const models = require('../models');
const limiters = require('../middleware/limiters');
const { sendMagicLinkEmail } = require('../services/emailService');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email('Valid email is required.')
});

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const hashToken = (token) =>
  crypto.createHmac('sha256', config.SESSION_SECRET).update(token).digest('hex');

const buildMagicLink = (token) => `${config.APP_URL}/auth/magic?token=${token}`;

router.get('/login', (req, res) => {
  res.render('auth/login', {
    title: 'Magic Link Login',
    layout: 'layout',
    errors: [],
    form: { email: '' }
  });
});

router.post('/login', limiters.login, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render('auth/login', {
        title: 'Magic Link Login',
        layout: 'layout',
        errors: ['Please enter a valid email address.'],
        form: { email: req.body?.email || '' }
      });
    }

    const email = normalizeEmail(parsed.data.email);
    const member = await models.Member.findOne({ email });

    if (member && member.emailStatus === 'approved' && member.status === 'active') {
      let user = await models.User.findOne({ memberId: member._id });
      if (!user) {
        user = await models.User.create({
          memberId: member._id,
          email,
          role: 'member',
          isActive: true
        });
      }

      if (user.isActive !== false) {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

        await models.AuthToken.create({
          userId: user._id,
          tokenHash,
          purpose: 'magicLogin',
          expiresAt
        });

        if (!config.APP_URL) {
          req.app?.locals?.logger?.error?.('APP_URL is missing; cannot send magic link.');
        } else {
          await sendMagicLinkEmail({ to: email, link: buildMagicLink(token) });
        }
      }
    }

    return res.render('auth/login-sent', {
      title: 'Check Your Email',
      layout: 'layout'
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/auth/magic', async (req, res, next) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).render('auth/login-error', {
        title: 'Unable to Sign In',
        layout: 'layout'
      });
    }

    const tokenHash = hashToken(token);
    const now = new Date();
    const authToken = await models.AuthToken.findOne({
      tokenHash,
      purpose: 'magicLogin',
      usedAt: null,
      expiresAt: { $gt: now }
    });

    if (!authToken) {
      return res.status(400).render('auth/login-error', {
        title: 'Unable to Sign In',
        layout: 'layout'
      });
    }

    authToken.usedAt = now;
    await authToken.save();

    const user = await models.User.findById(authToken.userId);
    if (!user || user.isActive === false) {
      return res.status(400).render('auth/login-error', {
        title: 'Unable to Sign In',
        layout: 'layout'
      });
    }

    const member = user.memberId ? await models.Member.findById(user.memberId) : null;
    if (member && member.status !== 'active') {
      return res.status(400).render('auth/login-error', {
        title: 'Unable to Sign In',
        layout: 'layout'
      });
    }

    user.lastLoginAt = now;
    await user.save();

    const displayName = member
      ? [member.firstName, member.lastName].filter(Boolean).join(' ')
      : [user.firstName, user.lastName].filter(Boolean).join(' ');

    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: displayName || null
    };

    return res.redirect('/portal');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
