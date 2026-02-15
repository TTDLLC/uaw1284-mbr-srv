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
  audienceType: z.enum(['all', 'departments', 'labels']),
  departmentIds: z.array(z.string()).optional().default([]),
  labelIds: z.array(z.string()).optional().default([]),
  subject: z.string().optional(),
  body: z.string().min(1, 'Message body is required.'),
  isTestSend: z.string().optional(),
  isAnnouncement: z.string().optional()
});

const ensureSubject = (channel, subject) => {
  if (channel === 'sms') {
    return true;
  }
  return Boolean(subject && subject.trim().length > 0);
};

const toDepartmentIds = (ids) => ids.filter(Boolean);

const getDepartments = () => models.Department.find({ active: true }).sort({ name: 1 }).lean();

const normalizeDepartmentIds = (value) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const normalizeCheckbox = (value) => value === true || value === '1' || value === 'true';

const buildFormData = (body, defaults = {}) => ({
  channel: body?.channel || defaults.channel || 'email',
  audienceType: body?.audienceType || defaults.audienceType || 'all',
  departmentIds: normalizeDepartmentIds(body?.departmentIds || defaults.departmentIds || []),
  labelIds: normalizeDepartmentIds(body?.labelIds || defaults.labelIds || []),
  subject: body?.subject || defaults.subject || '',
  body: body?.body || defaults.body || '',
  isTestSend: normalizeCheckbox(body?.isTestSend || defaults.isTestSend),
  isAnnouncement: normalizeCheckbox(body?.isAnnouncement ?? defaults.isAnnouncement)
});

const normalizePreviewSession = (req) => {
  if (!req.session?.notificationPreview?.formData) {
    return null;
  }
  return req.session.notificationPreview.formData;
};

const isTestSendSelected = (formData) => Boolean(formData?.isTestSend);

const getMemberEligibility = (member) => ({
  emailEligible: member.emailStatus === 'approved' && Boolean(member.email),
  smsEligible: member.phoneVerified === true && member.smsOptIn === true && Boolean(member.phone)
});

const buildPreviewPayload = async ({ formData, user }) => {
  const isTestSend = isTestSendSelected(formData);
  let members = [];

  if (isTestSend) {
    if (user?.memberId) {
      const member = await models.Member.findById(user.memberId).lean();
      if (member) {
        members = [member];
      }
    }
  } else if (formData.audienceType === 'departments') {
    members = await models.Member.find({
      status: 'active',
      departmentId: { $in: toDepartmentIds(formData.departmentIds || []) }
    }).lean();
  } else if (formData.audienceType === 'labels') {
    members = await models.Member.find({
      status: 'active',
      labelIds: { $in: toDepartmentIds(formData.labelIds || []) }
    }).lean();
  } else {
    members = await models.Member.find({ status: 'active' }).lean();
  }

  const emailMembers = [];
  const smsMembers = [];

  members.forEach((member) => {
    const eligibility = getMemberEligibility(member);
    if ((formData.channel === 'email' || formData.channel === 'both') && eligibility.emailEligible) {
      emailMembers.push(member);
    }
    if ((formData.channel === 'sms' || formData.channel === 'both') && eligibility.smsEligible) {
      smsMembers.push(member);
    }
  });

  return {
    isTestSend,
    totalTargeted: isTestSend ? (members.length ? 1 : 0) : members.length,
    emailEligible: emailMembers.length,
    smsEligible: smsMembers.length,
    memberIdsByChannel: {
      email: emailMembers.map((member) => member._id.toString()),
      sms: smsMembers.map((member) => member._id.toString())
    }
  };
};

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

router.get('/notifications/new', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const limiterMessage = req.session?.notificationLimiterMessage;
    if (req.session) {
      req.session.notificationLimiterMessage = null;
    }
    const departments = await getDepartments();
    const labels = await models.Label.find({ active: true }).sort({ name: 1 }).lean();
    const previewForm = normalizePreviewSession(req);

    return res.render('portal/staff/notifications/new', {
      title: 'Compose Notification',
      layout: 'layout',
      errors: limiterMessage ? [limiterMessage] : [],
      form: previewForm || {
        channel: 'email',
        audienceType: 'all',
        departmentIds: [],
        labelIds: [],
        subject: '',
        body: '',
        isTestSend: false,
        isAnnouncement: false
      },
      departments,
      labels
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/notifications/preview',
  attachUser,
  requireAuth,
  requireRole('staff'),
  async (req, res, next) => {
    try {
      const parsed = notificationSchema.safeParse(req.body);
      const departments = await getDepartments();
      const labels = await models.Label.find({ active: true }).sort({ name: 1 }).lean();

      if (!parsed.success) {
        const form = buildFormData(req.body);
        return res.status(400).render('portal/staff/notifications/new', {
          title: 'Compose Notification',
          layout: 'layout',
          errors: ['Please complete all required fields.'],
          form,
          departments,
          labels
        });
      }

      const formData = buildFormData(parsed.data);
      if (!ensureSubject(formData.channel, formData.subject)) {
        return res.status(400).render('portal/staff/notifications/new', {
          title: 'Compose Notification',
          layout: 'layout',
          errors: ['Subject is required for email notifications.'],
          form: formData,
          departments,
          labels
        });
      }

      if (formData.audienceType === 'departments' && !isTestSendSelected(formData)) {
        if (!toDepartmentIds(formData.departmentIds).length) {
          return res.status(400).render('portal/staff/notifications/new', {
            title: 'Compose Notification',
            layout: 'layout',
            errors: ['Select at least one department.'],
            form: formData,
            departments,
            labels
          });
        }
      }

      if (formData.audienceType === 'labels' && !isTestSendSelected(formData)) {
        if (!toDepartmentIds(formData.labelIds).length) {
          return res.status(400).render('portal/staff/notifications/new', {
            title: 'Compose Notification',
            layout: 'layout',
            errors: ['Select at least one label.'],
            form: formData,
            departments,
            labels
          });
        }
      }

      const activeLabelIds = labels.map((label) => String(label._id));
      const selectedLabelIds = toDepartmentIds(formData.labelIds || [])
        .filter((id) => activeLabelIds.includes(String(id)));

      if (formData.audienceType === 'labels' && !isTestSendSelected(formData)) {
        if (!selectedLabelIds.length) {
          return res.status(400).render('portal/staff/notifications/new', {
            title: 'Compose Notification',
            layout: 'layout',
            errors: ['Select at least one label.'],
            form: formData,
            departments,
            labels
          });
        }
      }

      const preview = await buildPreviewPayload({ formData: { ...formData, labelIds: selectedLabelIds }, user: req.user });

      const previewFormData = {
        ...formData,
        labelIds: selectedLabelIds
      };

      if (isTestSendSelected(previewFormData)) {
        previewFormData.isAnnouncement = false;
      }

      req.session.notificationPreview = {
        formData: previewFormData,
        counts: {
          totalTargeted: preview.totalTargeted,
          emailEligible: preview.emailEligible,
          smsEligible: preview.smsEligible
        },
        memberIdsByChannel: preview.memberIdsByChannel,
        isTestSend: preview.isTestSend
      };

      return res.render('portal/staff/notifications/preview', {
        title: 'Preview Notification',
        layout: 'layout',
        form: req.session.notificationPreview.formData,
        counts: req.session.notificationPreview.counts,
        departments,
        labels,
        isTestSend: preview.isTestSend
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/notifications',
  attachUser,
  requireAuth,
  requireRole('staff'),
  limiters.notificationCreate,
  async (req, res, next) => {
    try {
      const preview = req.session?.notificationPreview;
      if (!preview?.formData) {
        if (req.session) {
          req.session.notificationLimiterMessage = 'Please preview your notification before sending.';
        }
        return res.redirect('/portal/staff/notifications/new');
      }

      const { formData, counts, memberIdsByChannel, isTestSend } = preview;
      const departmentIds = toDepartmentIds(formData.departmentIds || []);
      const labelIds = toDepartmentIds(formData.labelIds || []);
      const channel = formData.channel;
      const isAnnouncement = Boolean(formData.isAnnouncement) && !isTestSend;
      const audienceType = isTestSend ? 'test' : formData.audienceType;

      const notification = await models.Notification.create({
        createdByUserId: req.user?._id || req.user?.id,
        channel,
        audienceType,
        departmentIds: audienceType === 'departments' ? departmentIds : [],
        labelIds: audienceType === 'labels' ? labelIds : [],
        subject: channel === 'sms' ? null : formData.subject,
        body: formData.body,
        status: 'queued',
        totalTargeted: counts.totalTargeted,
        emailEligible: counts.emailEligible,
        smsEligible: counts.smsEligible,
        sent: 0,
        failed: 0,
        isAnnouncement
      });

      const recipients = [];
      if (channel === 'email' || channel === 'both') {
        const emailMembers = await models.Member.find({ _id: { $in: memberIdsByChannel.email } })
          .select({ email: 1 })
          .lean();
        emailMembers.forEach((member) => {
          recipients.push({
            notificationId: notification._id,
            memberId: member._id,
            channel: 'email',
            destination: member.email
          });
        });
      }
      if (channel === 'sms' || channel === 'both') {
        const smsMembers = await models.Member.find({ _id: { $in: memberIdsByChannel.sms } })
          .select({ phone: 1 })
          .lean();
        smsMembers.forEach((member) => {
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
      if (req.session) {
        req.session.notificationPreview = null;
      }

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
      error: failure.error ? String(failure.error).slice(0, 140) : 'Send failed',
      errorCode: failure.errorCode || 'UNKNOWN',
      attempts: failure.attempts || 0,
      createdAtFormatted: failure.createdAt ? new Date(failure.createdAt).toLocaleString() : '—'
    }));

    const labels = notification.labelIds?.length
      ? await models.Label.find({ _id: { $in: notification.labelIds } }).lean()
      : [];

    return res.render('portal/staff/notifications/show', {
      title: 'Notification Detail',
      layout: 'layout',
      notification,
      labels,
      failures: failureRows
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
