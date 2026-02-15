const express = require('express');
const mongoose = require('mongoose');

const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS, hasPermission } = require('../config/permissions');
const models = require('../models');
const { logAction } = require('../utils/audit');

const router = express.Router();

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildAudienceMatch = (member) => {
  if (!member) {
    return { 'audience.scope': 'all' };
  }

  const conditions = [{ 'audience.scope': 'all' }];

  const mixedOr = [];

  if (member.departmentId) {
    conditions.push({
      'audience.scope': 'departments',
      'audience.departmentIds': member.departmentId
    });
    mixedOr.push({ 'audience.departmentIds': member.departmentId });
  }

  if (member.labelIds?.length) {
    conditions.push({
      'audience.scope': 'labels',
      'audience.labelIds': { $in: member.labelIds }
    });
    mixedOr.push({ 'audience.labelIds': { $in: member.labelIds } });
  }

  if (mixedOr.length) {
    conditions.push({
      'audience.scope': 'mixed',
      $or: mixedOr
    });
  }

  return { $or: conditions };
};

const canAccessResource = (resource, member, canManage) => {
  if (!resource || resource.active === false) {
    return false;
  }
  if (canManage) {
    return true;
  }
  const scope = resource.audience?.scope || 'all';
  if (scope === 'all') {
    return true;
  }
  if (!member) {
    return false;
  }
  const departmentId = member.departmentId ? String(member.departmentId) : null;
  const labelIds = (member.labelIds || []).map((id) => String(id));

  if (scope === 'departments') {
    return Boolean(departmentId && resource.audience?.departmentIds?.some((id) => String(id) === departmentId));
  }
  if (scope === 'labels') {
    return resource.audience?.labelIds?.some((id) => labelIds.includes(String(id)));
  }
  if (scope === 'mixed') {
    const deptMatch = departmentId
      && resource.audience?.departmentIds?.some((id) => String(id) === departmentId);
    const labelMatch = resource.audience?.labelIds?.some((id) => labelIds.includes(String(id)));
    return Boolean(deptMatch || labelMatch);
  }
  return false;
};

router.get('/resources', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_READ), async (req, res, next) => {
  try {
    const member = req.member || null;
    const canManage = hasPermission(req.user || req.session?.user, PERMISSIONS.RESOURCES_MANAGE);
    const type = String(req.query.type || '').trim();
    const q = String(req.query.q || '').trim();

    const filter = { active: true };
    if (type && ['link', 'file'].includes(type)) {
      filter.type = type;
    }
    if (q) {
      filter.title = new RegExp(escapeRegex(q), 'i');
    }

    if (!canManage) {
      Object.assign(filter, buildAudienceMatch(member));
    }

    const resources = await models.Resource.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const rows = resources.map((resource) => ({
      id: resource._id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      createdAtFormatted: resource.createdAt ? new Date(resource.createdAt).toLocaleDateString() : '—'
    }));

    return res.render('portal/resources/index', {
      title: 'Resources',
      layout: 'layout',
      resources: rows,
      type,
      q
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/resources/:id', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_READ), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const resource = await models.Resource.findById(req.params.id).lean();
    if (!resource) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }
    const canManage = hasPermission(req.user || req.session?.user, PERMISSIONS.RESOURCES_MANAGE);
    if (!canAccessResource(resource, req.member, canManage)) {
      return res.status(403).render('403', {
        title: 'Access Denied',
        layout: 'layout',
        requestId: req.id,
        msg: 'You do not have access to this resource.'
      });
    }

    return res.render('portal/resources/show', {
      title: resource.title,
      layout: 'layout',
      resource
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/resources/:id/download', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_READ), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const resource = await models.Resource.findById(req.params.id).lean();
    if (!resource) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }
    const canManage = hasPermission(req.user || req.session?.user, PERMISSIONS.RESOURCES_MANAGE);
    if (!canAccessResource(resource, req.member, canManage)) {
      return res.status(403).render('403', {
        title: 'Access Denied',
        layout: 'layout',
        requestId: req.id,
        msg: 'You do not have access to this resource.'
      });
    }

    if (resource.type !== 'file' || !resource.file?.path) {
      return res.status(400).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'resource.download',
      targetType: 'resource',
      targetId: resource._id,
      metadata: {
        resourceId: String(resource._id),
        title: resource.title,
        type: resource.type,
        scope: resource.audience?.scope || 'all'
      },
      req
    });

    return res.download(resource.file.path, resource.file.originalName || 'resource');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
