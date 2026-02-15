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

const buildVisibilityFilter = (member) => {
  if (!member) {
    return { visibility: 'all' };
  }

  const conditions = [{ visibility: 'all' }];
  const mixedOr = [];

  if (member.departmentId) {
    conditions.push({
      visibility: 'departments',
      departmentIds: member.departmentId
    });
    mixedOr.push({ departmentIds: member.departmentId });
  }

  if (member.labelIds?.length) {
    conditions.push({
      visibility: 'labels',
      labelIds: { $in: member.labelIds }
    });
    mixedOr.push({ labelIds: { $in: member.labelIds } });
  }

  if (mixedOr.length) {
    conditions.push({
      visibility: 'mixed',
      $or: mixedOr
    });
  }

  return { $or: conditions };
};

const loadEventRsvpCounts = async (eventIds) => {
  if (!eventIds.length) {
    return new Map();
  }
  const rows = await models.EventRsvp.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    { $group: { _id: { eventId: '$eventId', status: '$status' }, count: { $sum: 1 } } }
  ]);
  const map = new Map();
  rows.forEach((row) => {
    const eventId = String(row._id.eventId);
    if (!map.has(eventId)) {
      map.set(eventId, { yes: 0, no: 0, maybe: 0 });
    }
    const counts = map.get(eventId);
    counts[row._id.status] = row.count;
  });
  return map;
};

router.get('/events', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_READ), async (req, res, next) => {
  try {
    const member = req.member || null;
    const canManage = hasPermission(req.user || req.session?.user, PERMISSIONS.EVENTS_MANAGE);
    const now = new Date();
    const windowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const filter = {
      active: true,
      startAt: { $gte: windowStart }
    };

    if (!canManage) {
      Object.assign(filter, buildVisibilityFilter(member));
    }

    const events = await models.Event.find(filter)
      .sort({ startAt: 1 })
      .lean();

    const eventIds = events.map((event) => event._id);
    const rsvpCounts = await loadEventRsvpCounts(eventIds);
    const memberRsvp = member
      ? await models.EventRsvp.find({ eventId: { $in: eventIds }, memberId: member._id }).lean()
      : [];
    const rsvpMap = new Map(memberRsvp.map((entry) => [String(entry.eventId), entry.status]));

    const rows = events.map((event) => {
      const counts = rsvpCounts.get(String(event._id)) || { yes: 0, no: 0, maybe: 0 };
      const capacity = event.capacity || null;
      return {
        id: event._id,
        title: event.title,
        location: event.location,
        startAtFormatted: event.startAt ? new Date(event.startAt).toLocaleString() : '—',
        rsvpStatus: rsvpMap.get(String(event._id)) || null,
        counts,
        capacity
      };
    });

    return res.render('portal/events/index', {
      title: 'Events',
      layout: 'layout',
      events: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/events/:id', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_READ), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }
    const event = await models.Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const member = req.member || null;
    const canManage = hasPermission(req.user || req.session?.user, PERMISSIONS.EVENTS_MANAGE);
    if (!canManage) {
      const allowed = buildVisibilityFilter(member);
      const allowedEvent = await models.Event.exists({ _id: event._id, ...allowed });
      if (!allowedEvent) {
        return res.status(403).render('403', {
          title: 'Access Denied',
          layout: 'layout',
          requestId: req.id,
          msg: 'You do not have access to this event.'
        });
      }
    }

    const rsvp = member
      ? await models.EventRsvp.findOne({ eventId: event._id, memberId: member._id }).lean()
      : null;
    const counts = await models.EventRsvp.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const countMap = counts.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, { yes: 0, no: 0, maybe: 0 });

    const now = new Date();
    const deadlinePassed = event.rsvpDeadlineAt && event.rsvpDeadlineAt < now;
    const capacityReached = event.capacity && countMap.yes >= event.capacity;

    return res.render('portal/events/show', {
      title: event.title,
      layout: 'layout',
      event,
      rsvp,
      counts: countMap,
      deadlinePassed: Boolean(deadlinePassed),
      capacityReached: Boolean(capacityReached)
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/events/:id/rsvp', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_RSVP), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const member = req.member;
    if (!member) {
      return res.status(400).render('403', {
        title: 'Access Denied',
        layout: 'layout',
        requestId: req.id,
        msg: 'Member profile is required to RSVP.'
      });
    }

    const event = await models.Event.findById(req.params.id);
    if (!event || event.active === false) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const allowed = buildVisibilityFilter(member);
    const allowedEvent = await models.Event.exists({ _id: event._id, ...allowed });
    if (!allowedEvent) {
      return res.status(403).render('403', {
        title: 'Access Denied',
        layout: 'layout',
        requestId: req.id,
        msg: 'You do not have access to this event.'
      });
    }

    const status = String(req.body?.status || '').trim();
    if (!['yes', 'no', 'maybe'].includes(status)) {
      return res.redirect(`/portal/events/${event._id}`);
    }

    const now = new Date();
    if (event.rsvpDeadlineAt && event.rsvpDeadlineAt < now) {
      return res.redirect(`/portal/events/${event._id}`);
    }

    const yesCount = await models.EventRsvp.countDocuments({ eventId: event._id, status: 'yes' });
    if (event.capacity && status === 'yes' && yesCount >= event.capacity) {
      return res.redirect(`/portal/events/${event._id}`);
    }

    const comment = String(req.body?.comment || '').trim();

    await models.EventRsvp.findOneAndUpdate(
      { eventId: event._id, memberId: member._id },
      { status, comment: comment || null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'event.rsvp',
      targetType: 'event',
      targetId: event._id,
      metadata: {
        eventId: String(event._id),
        title: event.title,
        startAt: event.startAt,
        visibility: event.visibility,
        status,
        comment: comment ? comment.slice(0, 50) : null
      },
      req
    });

    return res.redirect(`/portal/events/${event._id}`);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
