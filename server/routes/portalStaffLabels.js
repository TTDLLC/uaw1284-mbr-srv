const express = require('express');
const { z } = require('zod');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { logAction } = require('../utils/audit');

const router = express.Router();

const labelSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  color: z.string().optional().nullable(),
  active: z.string().optional()
});

const parseActive = (value) => value === 'on' || value === 'true' || value === '1';

router.get('/labels', attachUser, requireAuth, requireRole('staff'), async (_req, res, next) => {
  try {
    const labels = await models.Label.find({})
      .sort({ name: 1 })
      .lean();

    return res.render('portal/staff/labels/index', {
      title: 'Labels',
      layout: 'layout',
      labels
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/labels/new', attachUser, requireAuth, requireRole('staff'), (_req, res) => {
  res.render('portal/staff/labels/new', {
    title: 'New Label',
    layout: 'layout',
    errors: [],
    form: { name: '', color: '', active: true }
  });
});

router.post('/labels', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const parsed = labelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render('portal/staff/labels/new', {
        title: 'New Label',
        layout: 'layout',
        errors: parsed.error.issues.map((issue) => issue.message),
        form: { name: req.body?.name || '', color: req.body?.color || '', active: parseActive(req.body?.active) }
      });
    }

    const label = await models.Label.create({
      name: parsed.data.name,
      color: parsed.data.color || null,
      active: parseActive(parsed.data.active)
    });

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'label.create',
      targetType: 'label',
      targetId: label._id,
      metadata: {
        name: label.name,
        color: label.color,
        active: label.active
      },
      req
    });

    return res.redirect(`/portal/staff/labels/${label._id}/edit`);
  } catch (err) {
    if (err?.code === 11000) {
      const keyPattern = err.keyPattern || {};
      const keyValue = err.keyValue || {};
      let message = 'A label with that value already exists.';
      if (keyPattern.nameLower || keyValue.nameLower) {
        message = 'A label with that name already exists.';
      } else if (keyPattern.slug || keyValue.slug) {
        message = 'That label name results in a duplicate slug. Please choose a different name.';
      }
      return res.status(400).render('portal/staff/labels/new', {
        title: 'New Label',
        layout: 'layout',
        errors: [message],
        form: { name: req.body?.name || '', color: req.body?.color || '', active: parseActive(req.body?.active) }
      });
    }
    return next(err);
  }
});

router.get('/labels/:id/edit', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const label = await models.Label.findById(req.params.id).lean();
    if (!label) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    return res.render('portal/staff/labels/edit', {
      title: 'Edit Label',
      layout: 'layout',
      errors: [],
      label
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/labels/:id', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const label = await models.Label.findById(req.params.id);
    if (!label) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const parsed = labelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render('portal/staff/labels/edit', {
        title: 'Edit Label',
        layout: 'layout',
        errors: parsed.error.issues.map((issue) => issue.message),
        label: { ...label.toObject(), ...req.body, active: parseActive(req.body?.active) }
      });
    }

    const before = {
      name: label.name,
      color: label.color || null,
      active: label.active
    };

    label.name = parsed.data.name;
    label.color = parsed.data.color || null;
    label.active = parseActive(parsed.data.active);
    await label.save();

    const after = {
      name: label.name,
      color: label.color || null,
      active: label.active
    };

    const action = before.active && !after.active ? 'label.archive' : 'label.edit';

    await logAction({
      actorUserId: req.user || req.session?.user,
      action,
      targetType: 'label',
      targetId: label._id,
      metadata: {
        before,
        after
      },
      req
    });

    return res.redirect(`/portal/staff/labels/${label._id}/edit`);
  } catch (err) {
    if (err?.code === 11000) {
      const keyPattern = err.keyPattern || {};
      const keyValue = err.keyValue || {};
      let message = 'A label with that value already exists.';
      if (keyPattern.nameLower || keyValue.nameLower) {
        message = 'A label with that name already exists.';
      } else if (keyPattern.slug || keyValue.slug) {
        message = 'That label name results in a duplicate slug. Please choose a different name.';
      }
      const label = await models.Label.findById(req.params.id).lean();
      return res.status(400).render('portal/staff/labels/edit', {
        title: 'Edit Label',
        layout: 'layout',
        errors: [message],
        label: { ...label, ...req.body, active: parseActive(req.body?.active) }
      });
    }
    return next(err);
  }
});

module.exports = router;
