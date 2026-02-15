const express = require('express');

const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../config/permissions');
const models = require('../models');
const { logAction } = require('../utils/audit');

const router = express.Router();

const normalizeArray = (value) => {
  if (!value) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
};

const parseDateTime = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const toInputDateTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseActive = (value) => value === 'on' || value === 'true' || value === '1';

const loadAudienceOptions = async () => {
  const departments = await models.Department.find({ active: true }).sort({ name: 1 }).lean();
  const labels = await models.Label.find({ active: true }).sort({ name: 1 }).lean();
  return { departments, labels };
};

const buildEventPayload = (body) => {
  const visibility = ['all', 'departments', 'labels', 'mixed'].includes(body?.visibility)
    ? body.visibility
    : 'all';
  return {
    title: String(body?.title || '').trim(),
    description: String(body?.description || '').trim(),
    location: String(body?.location || '').trim(),
    startAt: parseDateTime(body?.startAt),
    endAt: parseDateTime(body?.endAt),
    timezone: String(body?.timezone || 'America/Detroit').trim() || 'America/Detroit',
    visibility,
    departmentIds: normalizeArray(body?.departmentIds),
    labelIds: normalizeArray(body?.labelIds),
    capacity: parseOptionalNumber(body?.capacity),
    rsvpDeadlineAt: parseDateTime(body?.rsvpDeadlineAt),
    active: parseActive(body?.active)
  };
};

const validateEventPayload = (payload) => {
  const errors = [];
  if (!payload.title) {
    errors.push('Title is required.');
  }
  if (!payload.startAt) {
    errors.push('Start time is required.');
  }
  if (payload.endAt && payload.startAt && payload.endAt < payload.startAt) {
    errors.push('End time must be after the start time.');
  }
  if (payload.rsvpDeadlineAt && payload.startAt && payload.rsvpDeadlineAt > payload.startAt) {
    errors.push('RSVP deadline must be before the event start time.');
  }
  if (payload.capacity != null && payload.capacity < 1) {
    errors.push('Capacity must be at least 1.');
  }
  return errors;
};

router.get('/events', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (_req, res, next) => {
  try {
    const events = await models.Event.find({})
      .sort({ startAt: 1 })
      .lean();

    const rows = events.map((event) => ({
      id: event._id,
      title: event.title,
      startAtFormatted: event.startAt ? new Date(event.startAt).toLocaleString() : '—',
      visibility: event.visibility || 'all',
      active: event.active !== false
    }));

    return res.render('portal/staff/events/index', {
      title: 'Manage Events',
      layout: 'layout',
      events: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/events/new', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (_req, res, next) => {
  try {
    const { departments, labels } = await loadAudienceOptions();
    return res.render('portal/staff/events/new', {
      title: 'New Event',
      layout: 'layout',
      errors: [],
      form: {
        title: '',
        description: '',
        location: '',
        startAt: '',
        endAt: '',
        timezone: 'America/Detroit',
        visibility: 'all',
        departmentIds: [],
        labelIds: [],
        capacity: '',
        rsvpDeadlineAt: '',
        active: true
      },
      departments,
      labels
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/events', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (req, res, next) => {
  try {
    const payload = buildEventPayload(req.body);
    const errors = validateEventPayload(payload);
    if (errors.length) {
      const { departments, labels } = await loadAudienceOptions();
      return res.status(400).render('portal/staff/events/new', {
        title: 'New Event',
        layout: 'layout',
        errors,
        form: {
          ...payload,
          startAt: req.body?.startAt || '',
          endAt: req.body?.endAt || '',
          rsvpDeadlineAt: req.body?.rsvpDeadlineAt || '',
          capacity: req.body?.capacity || ''
        },
        departments,
        labels
      });
    }

    const event = await models.Event.create({
      title: payload.title,
      description: payload.description || null,
      location: payload.location || null,
      startAt: payload.startAt,
      endAt: payload.endAt,
      timezone: payload.timezone,
      visibility: payload.visibility,
      departmentIds: payload.visibility === 'all' ? [] : payload.departmentIds,
      labelIds: payload.visibility === 'all' ? [] : payload.labelIds,
      capacity: payload.capacity,
      rsvpDeadlineAt: payload.rsvpDeadlineAt,
      active: payload.active,
      createdByUserId: req.user?._id || req.user?.id || null
    });

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'event.create',
      targetType: 'event',
      targetId: event._id,
      metadata: {
        eventId: String(event._id),
        title: event.title,
        startAt: event.startAt,
        visibility: event.visibility
      },
      req
    });

    return res.redirect(`/portal/staff/events/${event._id}/edit`);
  } catch (err) {
    return next(err);
  }
});

router.get('/events/:id/edit', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (req, res, next) => {
  try {
    const event = await models.Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }
    const { departments, labels } = await loadAudienceOptions();
    return res.render('portal/staff/events/edit', {
      title: 'Edit Event',
      layout: 'layout',
      event,
      form: {
        ...event,
        startAt: toInputDateTime(event.startAt),
        endAt: toInputDateTime(event.endAt),
        rsvpDeadlineAt: toInputDateTime(event.rsvpDeadlineAt)
      },
      departments,
      labels,
      errors: [],
      success: null
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/events/:id', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (req, res, next) => {
  try {
    const event = await models.Event.findById(req.params.id);
    if (!event) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const payload = buildEventPayload(req.body);
    const errors = validateEventPayload(payload);
    if (errors.length) {
      const { departments, labels } = await loadAudienceOptions();
      return res.status(400).render('portal/staff/events/edit', {
        title: 'Edit Event',
        layout: 'layout',
        event: event.toObject(),
        form: {
          ...payload,
          startAt: req.body?.startAt || '',
          endAt: req.body?.endAt || '',
          rsvpDeadlineAt: req.body?.rsvpDeadlineAt || '',
          capacity: req.body?.capacity || ''
        },
        departments,
        labels,
        errors,
        success: null
      });
    }

    const before = {
      title: event.title,
      startAt: event.startAt,
      visibility: event.visibility,
      active: event.active !== false
    };

    event.title = payload.title;
    event.description = payload.description || null;
    event.location = payload.location || null;
    event.startAt = payload.startAt;
    event.endAt = payload.endAt;
    event.timezone = payload.timezone;
    event.visibility = payload.visibility;
    event.departmentIds = payload.visibility === 'all' ? [] : payload.departmentIds;
    event.labelIds = payload.visibility === 'all' ? [] : payload.labelIds;
    event.capacity = payload.capacity;
    event.rsvpDeadlineAt = payload.rsvpDeadlineAt;
    event.active = payload.active;
    await event.save();

    const after = {
      title: event.title,
      startAt: event.startAt,
      visibility: event.visibility,
      active: event.active !== false
    };

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: event.active ? 'event.update' : 'event.archive',
      targetType: 'event',
      targetId: event._id,
      metadata: {
        eventId: String(event._id),
        title: event.title,
        startAt: event.startAt,
        visibility: event.visibility,
        before,
        after
      },
      req
    });

    const { departments, labels } = await loadAudienceOptions();
    return res.render('portal/staff/events/edit', {
      title: 'Edit Event',
      layout: 'layout',
      event: event.toObject(),
      form: {
        ...event.toObject(),
        startAt: toInputDateTime(event.startAt),
        endAt: toInputDateTime(event.endAt),
        rsvpDeadlineAt: toInputDateTime(event.rsvpDeadlineAt)
      },
      departments,
      labels,
      errors: [],
      success: 'Event updated successfully.'
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/events/:id/archive', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (req, res, next) => {
  try {
    const event = await models.Event.findById(req.params.id);
    if (!event) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    event.active = false;
    await event.save();

    await logAction({
      actorUserId: req.user || req.session?.user,
      action: 'event.archive',
      targetType: 'event',
      targetId: event._id,
      metadata: {
        eventId: String(event._id),
        title: event.title,
        startAt: event.startAt,
        visibility: event.visibility
      },
      req
    });

    return res.redirect(`/portal/staff/events/${event._id}/edit`);
  } catch (err) {
    return next(err);
  }
});

router.get('/events/:id/attendees', attachUser, requireAuth, requirePermission(PERMISSIONS.EVENTS_MANAGE), async (req, res, next) => {
  try {
    const event = await models.Event.findById(req.params.id).lean();
    if (!event) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const rsvps = await models.EventRsvp.find({ eventId: event._id })
      .sort({ updatedAt: -1 })
      .lean();

    const memberIds = rsvps.map((rsvp) => rsvp.memberId);
    const members = memberIds.length
      ? await models.Member.find({ _id: { $in: memberIds } })
        .select({ firstName: 1, lastName: 1, cid: 1 })
        .lean()
      : [];
    const memberMap = new Map(members.map((member) => [String(member._id), member]));

    const counts = rsvps.reduce((acc, rsvp) => {
      acc[rsvp.status] = (acc[rsvp.status] || 0) + 1;
      return acc;
    }, { yes: 0, no: 0, maybe: 0 });

    const rows = rsvps.map((rsvp) => {
      const member = memberMap.get(String(rsvp.memberId));
      return {
        name: member ? [member.firstName, member.lastName].filter(Boolean).join(' ') : 'Unknown Member',
        cid: member?.cid || '—',
        status: rsvp.status,
        comment: rsvp.comment || ''
      };
    });

    return res.render('portal/staff/events/attendees', {
      title: 'Event Attendees',
      layout: 'layout',
      event,
      counts,
      capacity: event.capacity || null,
      attendees: rows
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
