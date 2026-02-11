const express = require('express');
const { z } = require('zod');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const limiters = require('../middleware/limiters');
const { enqueueNotificationSend } = require('../jobs/notificationSender');

const router = express.Router();

const notificationSchema = z.object({
  channel: z.enum(['email', 'sms', 'both']),
  audienceType: z.enum(['all', 'departments']),
  departmentIds: z.array(z.string()).optional().default([]),
  subject: z.string().optional(),
  body: z.string().min(1, 'Message body is required.')
});

const ensureSubject = (channel, subject) => {
  if (channel === 'sms') {
    return true;
  }
  return Boolean(subject && subject.trim().length > 0);
};

const toDepartmentIds = (ids) => ids.filter(Boolean);

router.get('/notifications', attachUser, requireAuth, requireRole('staff'), async (_req, res, next) => {
  try {
    const notifications = await models.Notification.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const rows = notifications.map((notification) => ({
      id: notification._id,
      channel: notification.channel,
      audienceType: notification.audienceType,
      status: notification.status,
      createdAtFormatted: notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '—',
      sent: notification.sent || 0,
      failed: notification.failed || 0
    }));

    return res.render('portal/staff/notifications/index', {
      title: 'Notifications',
      layout: 'layout',
      notifications: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/notifications/new', attachUser, requireAuth, requireRole('staff'), async (_req, res, next) => {
  try {
    const limiterMessage = res.req?.session?.notificationLimiterMessage;
    if (res.req?.session) {
      res.req.session.notificationLimiterMessage = null;
    }
    const departments = await models.Department.find({ active: true })
      .sort({ name: 1 })
      .lean();

    return res.render('portal/staff/notifications/new', {
      title: 'Compose Notification',
      layout: 'layout',
      errors: limiterMessage ? [limiterMessage] : [],
      form: { channel: 'email', audienceType: 'all', departmentIds: [], subject: '', body: '' },
      departments
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/notifications',
  attachUser,
  requireAuth,
  requireRole('staff'),
  limiters.notificationCreate,
  async (req, res, next) => {
    try {
      const parsed = notificationSchema.safeParse(req.body);
      if (!parsed.success) {
        const departments = await models.Department.find({ active: true })
          .sort({ name: 1 })
          .lean();
        return res.status(400).render('portal/staff/notifications/new', {
          title: 'Compose Notification',
          layout: 'layout',
          errors: ['Please complete all required fields.'],
          form: {
            channel: req.body?.channel || 'email',
            audienceType: req.body?.audienceType || 'all',
            departmentIds: req.body?.departmentIds || [],
            subject: req.body?.subject || '',
            body: req.body?.body || ''
          },
          departments
        });
      }

      const { channel, audienceType, subject, body } = parsed.data;
      const departmentIds = toDepartmentIds(parsed.data.departmentIds || []);

      if (!ensureSubject(channel, subject)) {
        const departments = await models.Department.find({ active: true })
          .sort({ name: 1 })
          .lean();
        return res.status(400).render('portal/staff/notifications/new', {
          title: 'Compose Notification',
          layout: 'layout',
          errors: ['Subject is required for email notifications.'],
          form: {
            channel,
            audienceType,
            departmentIds,
            subject: subject || '',
            body
          },
          departments
        });
      }

      const memberQuery = { status: 'active' };
      if (audienceType === 'departments') {
        if (departmentIds.length === 0) {
          const departments = await models.Department.find({ active: true })
            .sort({ name: 1 })
            .lean();
          return res.status(400).render('portal/staff/notifications/new', {
            title: 'Compose Notification',
            layout: 'layout',
            errors: ['Select at least one department.'],
            form: {
              channel,
              audienceType,
              departmentIds,
              subject: subject || '',
              body
            },
            departments
          });
        }
        memberQuery.departmentId = { $in: departmentIds };
      }

      const members = await models.Member.find(memberQuery).lean();

      const emailEligible = members.filter((member) =>
        member.emailStatus === 'approved' && member.email
      );

      const smsEligible = members.filter((member) =>
        member.phoneVerified === true && member.smsOptIn === true && member.phone
      );

      const notification = await models.Notification.create({
        createdByUserId: req.user?._id || req.user?.id,
        channel,
        audienceType,
        departmentIds: audienceType === 'departments' ? departmentIds : [],
        subject: channel === 'sms' ? null : subject,
        body,
        status: 'queued',
        totalTargeted: members.length,
        emailEligible: emailEligible.length,
        smsEligible: smsEligible.length,
        sent: 0,
        failed: 0
      });

      const recipients = [];
      if (channel === 'email' || channel === 'both') {
        emailEligible.forEach((member) => {
          recipients.push({
            notificationId: notification._id,
            memberId: member._id,
            channel: 'email',
            destination: member.email
          });
        });
      }
      if (channel === 'sms' || channel === 'both') {
        smsEligible.forEach((member) => {
          recipients.push({
            notificationId: notification._id,
            memberId: member._id,
            channel: 'sms',
            destination: member.phone
          });
        });
      }

      if (recipients.length) {
        await models.NotificationRecipient.insertMany(recipients);
      }

      enqueueNotificationSend(notification._id);

      return res.redirect(`/portal/staff/notifications/${notification._id}`);
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/notifications/:id', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const notification = await models.Notification.findById(req.params.id).lean();
    if (!notification) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const failures = await models.NotificationRecipient.find({
      notificationId: notification._id,
      status: 'failed'
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const failureRows = failures.map((failure) => ({
      channel: failure.channel,
      destination: failure.destination,
      error: failure.error || 'Send failed',
      createdAtFormatted: failure.createdAt ? new Date(failure.createdAt).toLocaleString() : '—'
    }));

    return res.render('portal/staff/notifications/show', {
      title: 'Notification Detail',
      layout: 'layout',
      notification,
      failures: failureRows
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
