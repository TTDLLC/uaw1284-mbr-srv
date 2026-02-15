const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const multer = require('multer');

const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../config/permissions');
const models = require('../models');
const { logAction } = require('../utils/audit');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/resources');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Unsupported file type.'));
  }
}).single('file');

const normalizeArray = (value) => {
  if (!value) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
};

const parseActive = (value) => value === 'on' || value === 'true' || value === '1';

const buildAudience = (scope, departmentIds, labelIds) => {
  const normalizedScope = ['all', 'departments', 'labels', 'mixed'].includes(scope)
    ? scope
    : 'all';
  return {
    scope: normalizedScope,
    departmentIds: normalizedScope === 'all' ? [] : departmentIds,
    labelIds: normalizedScope === 'all' ? [] : labelIds
  };
};

const removeUpload = (file) => {
  if (!file?.path) {
    return;
  }
  fs.unlink(file.path, () => undefined);
};

const loadAudienceOptions = async () => {
  const departments = await models.Department.find({ active: true }).sort({ name: 1 }).lean();
  const labels = await models.Label.find({ active: true }).sort({ name: 1 }).lean();
  return { departments, labels };
};

router.get('/resources', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_MANAGE), async (_req, res, next) => {
  try {
    const resources = await models.Resource.find({})
      .sort({ createdAt: -1 })
      .lean();

    const rows = resources.map((resource) => ({
      id: resource._id,
      title: resource.title,
      type: resource.type,
      scope: resource.audience?.scope || 'all',
      active: resource.active !== false,
      createdAtFormatted: resource.createdAt ? new Date(resource.createdAt).toLocaleDateString() : '—'
    }));

    return res.render('portal/staff/resources/index', {
      title: 'Manage Resources',
      layout: 'layout',
      resources: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/resources/new', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_MANAGE), async (_req, res, next) => {
  try {
    const { departments, labels } = await loadAudienceOptions();
    return res.render('portal/staff/resources/new', {
      title: 'New Resource',
      layout: 'layout',
      errors: [],
      form: {
        title: '',
        description: '',
        type: 'link',
        url: '',
        scope: 'all',
        departmentIds: [],
        labelIds: [],
        active: true
      },
      departments,
      labels
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/resources', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_MANAGE), (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      const { departments, labels } = await loadAudienceOptions();
      return res.status(400).render('portal/staff/resources/new', {
        title: 'New Resource',
        layout: 'layout',
        errors: [err.message || 'File upload failed.'],
        form: {
          title: req.body?.title || '',
          description: req.body?.description || '',
          type: req.body?.type || 'link',
          url: req.body?.url || '',
          scope: req.body?.scope || 'all',
          departmentIds: normalizeArray(req.body?.departmentIds),
          labelIds: normalizeArray(req.body?.labelIds),
          active: parseActive(req.body?.active)
        },
        departments,
        labels
      });
    }

    try {
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      const type = req.body?.type === 'file' ? 'file' : 'link';
      const url = String(req.body?.url || '').trim();
      const scope = String(req.body?.scope || 'all').trim();
      const departmentIds = normalizeArray(req.body?.departmentIds);
      const labelIds = normalizeArray(req.body?.labelIds);
      const active = parseActive(req.body?.active);

      const errors = [];
      if (!title) {
        errors.push('Title is required.');
      }
      if (type === 'link' && !url) {
        errors.push('URL is required for link resources.');
      }
      if (type === 'file' && !req.file) {
        errors.push('File upload is required for file resources.');
      }

      if (errors.length) {
        removeUpload(req.file);
        const { departments, labels } = await loadAudienceOptions();
        return res.status(400).render('portal/staff/resources/new', {
          title: 'New Resource',
          layout: 'layout',
          errors,
          form: {
            title,
            description,
            type,
            url,
            scope,
            departmentIds,
            labelIds,
            active
          },
          departments,
          labels
        });
      }

      if (type === 'link' && req.file) {
        removeUpload(req.file);
      }

      const audience = buildAudience(scope, departmentIds, labelIds);
      const resource = await models.Resource.create({
        title,
        description: description || null,
        type,
        url: type === 'link' ? url : null,
        file: type === 'file'
          ? {
            originalName: req.file.originalname,
            storedName: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
          }
          : null,
        audience,
        active,
        createdByUserId: req.user?._id || req.user?.id || null
      });

      await logAction({
        actorUserId: req.user || req.session?.user,
        action: 'resource.create',
        targetType: 'resource',
        targetId: resource._id,
        metadata: {
          resourceId: String(resource._id),
          title,
          type,
          scope: audience.scope
        },
        req
      });

      return res.redirect(`/portal/staff/resources/${resource._id}/edit`);
    } catch (handlerErr) {
      removeUpload(req.file);
      return next(handlerErr);
    }
  });
});

router.get('/resources/:id/edit', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_MANAGE), async (req, res, next) => {
  try {
    const resource = await models.Resource.findById(req.params.id).lean();
    if (!resource) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }
    const { departments, labels } = await loadAudienceOptions();
    return res.render('portal/staff/resources/edit', {
      title: 'Edit Resource',
      layout: 'layout',
      resource,
      departments,
      labels,
      errors: [],
      success: null
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/resources/:id', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_MANAGE), async (req, res, next) => {
  try {
    const resource = await models.Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const url = String(req.body?.url || '').trim();
    const scope = String(req.body?.scope || 'all').trim();
    const departmentIds = normalizeArray(req.body?.departmentIds);
    const labelIds = normalizeArray(req.body?.labelIds);
    const active = parseActive(req.body?.active);

    const errors = [];
    if (!title) {
      errors.push('Title is required.');
    }
    if (resource.type === 'link' && !url) {
      errors.push('URL is required for link resources.');
    }

    if (errors.length) {
      const { departments, labels } = await loadAudienceOptions();
      return res.status(400).render('portal/staff/resources/edit', {
        title: 'Edit Resource',
        layout: 'layout',
        resource: {
          ...resource.toObject(),
          title,
          description,
          url,
          audience: buildAudience(scope, departmentIds, labelIds),
          active
        },
        departments,
        labels,
        errors,
        success: null
      });
    }

    const before = {
      title: resource.title,
      description: resource.description,
      scope: resource.audience?.scope || 'all',
      active: resource.active !== false
    };

    const audience = buildAudience(scope, departmentIds, labelIds);
    resource.title = title;
    resource.description = description || null;
    if (resource.type === 'link') {
      resource.url = url;
    }
    resource.audience = audience;
    resource.active = active;
    await resource.save();

    const after = {
      title: resource.title,
      description: resource.description,
      scope: resource.audience?.scope || 'all',
      active: resource.active !== false
    };

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: active ? 'resource.update' : 'resource.archive',
      targetType: 'resource',
      targetId: resource._id,
      metadata: {
        resourceId: String(resource._id),
        title: resource.title,
        type: resource.type,
        scope: audience.scope,
        before,
        after
      },
      req
    });

    const { departments, labels } = await loadAudienceOptions();
    return res.render('portal/staff/resources/edit', {
      title: 'Edit Resource',
      layout: 'layout',
      resource: resource.toObject(),
      departments,
      labels,
      errors: [],
      success: 'Resource updated successfully.'
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/resources/:id/archive', attachUser, requireAuth, requirePermission(PERMISSIONS.RESOURCES_MANAGE), async (req, res, next) => {
  try {
    const resource = await models.Resource.findById(req.params.id);
    if (!resource) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    resource.active = false;
    await resource.save();

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'resource.archive',
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

    return res.redirect(`/portal/staff/resources/${resource._id}/edit`);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
