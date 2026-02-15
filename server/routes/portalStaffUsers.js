const express = require('express');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../config/permissions');
const { logAction } = require('../utils/audit');

const router = express.Router();

const ROLE_OPTIONS = [
  'member',
  'rep',
  'steward',
  'officer',
  'benefitsAdmin',
  'staff',
  'admin',
  'readOnly'
];

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/users', attachUser, requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex }
      ];
    }

    const users = await models.User.find(filter)
      .sort({ lastName: 1, firstName: 1, email: 1 })
      .limit(100)
      .lean();

    const rows = users.map((user) => ({
      id: user._id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || '—',
      email: user.email,
      role: user.role
    }));

    return res.render('portal/staff/users/index', {
      title: 'User Role Management',
      layout: 'layout',
      users: rows,
      q
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/users/:id', attachUser, requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res, next) => {
  try {
    const user = await models.User.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    return res.render('portal/staff/users/show', {
      title: 'User Role Detail',
      layout: 'layout',
      user,
      roleOptions: ROLE_OPTIONS,
      success: null,
      errors: []
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/users/:id', attachUser, requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res, next) => {
  try {
    const user = await models.User.findById(req.params.id);
    if (!user) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const nextRole = String(req.body?.role || '').trim();
    if (!ROLE_OPTIONS.includes(nextRole)) {
      return res.status(400).render('portal/staff/users/show', {
        title: 'User Role Detail',
        layout: 'layout',
        user: user.toObject(),
        roleOptions: ROLE_OPTIONS,
        success: null,
        errors: ['Please select a valid role.']
      });
    }

    const before = { role: user.role };
    user.role = nextRole;
    await user.save();

    const after = { role: user.role };

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'user.role.update',
      targetType: 'user',
      targetId: user._id,
      metadata: { before, after },
      req
    });

    return res.render('portal/staff/users/show', {
      title: 'User Role Detail',
      layout: 'layout',
      user: user.toObject(),
      roleOptions: ROLE_OPTIONS,
      success: 'Role updated successfully.',
      errors: []
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
