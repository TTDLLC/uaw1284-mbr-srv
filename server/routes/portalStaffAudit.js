const express = require('express');
const mongoose = require('mongoose');

const models = require('../models');
const AuditLog = require('../models/auditLog');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { maskMetadataValue } = require('../utils/audit');

const router = express.Router();

const PAGE_SIZE = 50;
const DEFAULT_RANGE_DAYS = 30;
const MAX_EXPORT_DAYS = 90;

const parsePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildDateRange = (query) => {
  const requestedRange = String(query.range || '').trim();
  const range = ['7', '30', '90', 'custom'].includes(requestedRange)
    ? requestedRange
    : String(DEFAULT_RANGE_DAYS);

  let start = null;
  let end = null;
  let error = null;

  if (range === 'custom') {
    start = parseDate(query.start);
    end = parseDate(query.end);
    if (!start || !end) {
      error = 'Please provide a valid start and end date.';
    }
  } else {
    const days = Number.parseInt(range, 10);
    end = new Date();
    start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  }

  if (start) {
    start = startOfDay(start);
  }
  if (end) {
    end = endOfDay(end);
  }

  return { range, start, end, error };
};

const enforceExportWindow = (start, end) => {
  if (!start || !end) {
    return 'Export range must include both a start and end date.';
  }
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays > MAX_EXPORT_DAYS) {
    return `Export range cannot exceed ${MAX_EXPORT_DAYS} days.`;
  }
  return null;
};

const buildAuditFilter = async (req) => {
  const action = String(req.query.action || '').trim();
  const actor = String(req.query.actor || '').trim();
  const target = String(req.query.target || '').trim();
  const { range, start, end, error } = buildDateRange(req.query);

  const filter = {};
  if (action) {
    filter.action = action;
  }
  if (actor && mongoose.isValidObjectId(actor)) {
    filter.actorUserId = actor;
  }
  if (start || end) {
    filter.createdAt = {};
    if (start) {
      filter.createdAt.$gte = start;
    }
    if (end) {
      filter.createdAt.$lte = end;
    }
  }

  let matchedMembers = [];
  if (target) {
    const orConditions = [];
    if (mongoose.isValidObjectId(target)) {
      orConditions.push({ targetId: target });
    }
    const regex = new RegExp(escapeRegex(target), 'i');
    matchedMembers = await models.Member.find({
      $or: [
        { cid: regex },
        { firstName: regex },
        { lastName: regex }
      ]
    })
      .select({ _id: 1, firstName: 1, lastName: 1, cid: 1 })
      .limit(50)
      .lean();

    const memberIds = matchedMembers.map((member) => member._id);
    if (memberIds.length) {
      orConditions.push({ targetType: 'member', targetId: { $in: memberIds } });
    }

    if (orConditions.length) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: orConditions });
    } else {
      filter._id = null;
    }
  }

  return {
    filter,
    range,
    start,
    end,
    error,
    action,
    actor,
    target,
    matchedMembers
  };
};

const buildActorLabel = (user) => {
  if (!user) {
    return 'System';
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) {
    return `${name} (${user.email || 'no email'})`;
  }
  return user.email || 'Unknown user';
};

router.get('/audit', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const page = parsePage(req.query.page);
    const {
      filter,
      range,
      start,
      end,
      error,
      action,
      actor,
      target
    } = await buildAuditFilter(req);

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('actorUserId', 'firstName lastName email role')
      .lean();

    const actorIds = (await AuditLog.distinct('actorUserId', filter))
      .filter((id) => mongoose.isValidObjectId(id));
    const actors = actorIds.length
      ? await models.User.find({ _id: { $in: actorIds } })
        .select({ firstName: 1, lastName: 1, email: 1, role: 1 })
        .sort({ lastName: 1, firstName: 1 })
        .lean()
      : [];

    const actionOptions = await AuditLog.distinct('action');
    actionOptions.sort();

    const memberTargetIds = logs
      .filter((log) => (log.targetType || log.entityType) === 'member')
      .map((log) => log.targetId || log.entityId)
      .filter((value) => mongoose.isValidObjectId(value));

    const memberTargets = memberTargetIds.length
      ? await models.Member.find({ _id: { $in: memberTargetIds } })
        .select({ firstName: 1, lastName: 1, cid: 1 })
        .lean()
      : [];

    const memberMap = new Map(memberTargets.map((member) => [String(member._id), member]));

    const rows = logs.map((log) => {
      const targetType = log.targetType || log.entityType || null;
      const targetId = log.targetId || log.entityId || null;
      const targetMember = targetType === 'member' && targetId
        ? memberMap.get(String(targetId))
        : null;
      const targetLabel = targetMember
        ? `${[targetMember.firstName, targetMember.lastName].filter(Boolean).join(' ') || 'Member'} (${targetMember.cid || 'No CID'})`
        : targetId
          ? String(targetId)
          : '—';
      const actorUser = log.actorUserId;
      const legacyActor = log.actor;
      const actorLabel = actorUser
        ? buildActorLabel(actorUser)
        : legacyActor?.email
          ? `${legacyActor.email} (${legacyActor.role || 'n/a'})`
          : 'System';

      return {
        id: log._id,
        createdAt: log.createdAt,
        action: log.action,
        targetType: targetType || '—',
        targetLabel,
        actorLabel,
        ipAddress: log.ipAddress || '—'
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const queryParams = new URLSearchParams();
    if (action) {
      queryParams.set('action', action);
    }
    if (actor) {
      queryParams.set('actor', actor);
    }
    if (target) {
      queryParams.set('target', target);
    }
    if (range) {
      queryParams.set('range', range);
    }
    if (range === 'custom') {
      if (start) {
        queryParams.set('start', start.toISOString().slice(0, 10));
      }
      if (end) {
        queryParams.set('end', end.toISOString().slice(0, 10));
      }
    }
    const queryBase = queryParams.toString();

    return res.render('portal/staff/audit/index', {
      title: 'Audit Log',
      layout: 'layout',
      logs: rows,
      page,
      totalPages,
      total,
      range,
      start,
      end,
      error,
      action,
      actor,
      target,
      actionOptions,
      actors,
      isAdmin: req.user?.role === 'admin',
      queryBase
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/audit/export.csv', attachUser, requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const {
      filter,
      start,
      end,
      error
    } = await buildAuditFilter(req);

    if (error) {
      return res.status(400).send(error);
    }

    const exportError = enforceExportWindow(start, end);
    if (exportError) {
      return res.status(400).send(exportError);
    }

    const actorIds = (await AuditLog.distinct('actorUserId', filter))
      .filter((id) => mongoose.isValidObjectId(id));
    const actors = actorIds.length
      ? await models.User.find({ _id: { $in: actorIds } })
        .select({ firstName: 1, lastName: 1, email: 1 })
        .lean()
      : [];
    const actorMap = new Map(actors.map((actor) => [String(actor._id), actor]));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-export.csv"');

    const csvEscape = (value) => {
      const text = value == null ? '' : String(value);
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    res.write([
      'timestamp',
      'actor',
      'action',
      'targetType',
      'targetId',
      'metadata'
    ].join(',') + '\n');

    const cursor = AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .cursor();

    for await (const log of cursor) {
      const actor = log.actorUserId ? actorMap.get(String(log.actorUserId)) : null;
      const actorLabel = actor ? buildActorLabel(actor) : 'System';
      const maskedMetadata = log.metadata ? maskMetadataValue(log.metadata) : null;
      const row = [
        log.createdAt ? log.createdAt.toISOString() : '',
        actorLabel,
        log.action,
        log.targetType || log.entityType || '',
        log.targetId || log.entityId || '',
        maskedMetadata ? JSON.stringify(maskedMetadata) : ''
      ];
      res.write(row.map(csvEscape).join(',') + '\n');
    }

    return res.end();
  } catch (err) {
    return next(err);
  }
});

router.get('/audit/:id', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate('actorUserId', 'firstName lastName email role')
      .lean();

    if (!log) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const targetType = log.targetType || log.entityType || null;
    const targetId = log.targetId || log.entityId || null;
    let targetInfo = null;
    if (targetType === 'member' && mongoose.isValidObjectId(targetId)) {
      const member = await models.Member.findById(targetId)
        .select({ firstName: 1, lastName: 1, cid: 1 })
        .lean();
      if (member) {
        targetInfo = {
          name: [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || 'Member',
          cid: member.cid || 'No CID',
          id: member._id
        };
      }
    }

    const actorUser = log.actorUserId;
    const legacyActor = log.actor;
    const actorLabel = actorUser
      ? buildActorLabel(actorUser)
      : legacyActor?.email
        ? `${legacyActor.email} (${legacyActor.role || 'n/a'})`
        : 'System';

    const maskedMetadata = log.metadata ? maskMetadataValue(log.metadata) : null;

    return res.render('portal/staff/audit/show', {
      title: 'Audit Log Entry',
      layout: 'layout',
      log: {
        id: log._id,
        createdAt: log.createdAt,
        action: log.action,
        targetType: targetType || '—',
        targetId: targetId || '—',
        ipAddress: log.ipAddress || '—',
        userAgent: log.userAgent || '—',
        actorLabel,
        metadataJson: maskedMetadata ? JSON.stringify(maskedMetadata, null, 2) : null
      },
      targetInfo
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
