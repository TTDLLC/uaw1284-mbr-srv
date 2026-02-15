const express = require('express');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const ensureMember = (req, res) => {
  if (!req.member) {
    res.status(403).render('403', {
      title: 'Access Denied',
      layout: 'layout',
      requestId: req.id,
      msg: 'Member profile required to view announcements.'
    });
    return false;
  }
  return true;
};

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const buildTitleFromBody = (body) => {
  const trimmed = normalizeText(body);
  if (!trimmed) {
    return 'Announcement';
  }
  const maxLength = 70;
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trim()}...`;
};

const buildAnnouncementTitle = (notification) => {
  const subject = normalizeText(notification?.subject);
  if (subject) {
    return subject;
  }
  return buildTitleFromBody(notification?.body);
};

const buildPreview = (body) => {
  const trimmed = normalizeText(body);
  if (!trimmed) {
    return '—';
  }
  const maxLength = 140;
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trim()}...`;
};

const announcementQuery = {
  isAnnouncement: true,
  status: 'completed',
  publishedAt: { $exists: true, $ne: null }
};

router.get('/announcements', attachUser, requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    if (!ensureMember(req, res)) {
      return undefined;
    }

    const announcements = await models.Notification.find(announcementQuery)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    const notificationIds = announcements.map((announcement) => announcement._id);
    const reads = notificationIds.length
      ? await models.AnnouncementRead.find({
        memberId: req.member._id,
        notificationId: { $in: notificationIds }
      }).lean()
      : [];

    const readSet = new Set(reads.map((read) => String(read.notificationId)));

    const rows = announcements.map((announcement) => ({
      id: announcement._id,
      title: buildAnnouncementTitle(announcement),
      preview: buildPreview(announcement.body),
      publishedAtFormatted: announcement.publishedAt
        ? new Date(announcement.publishedAt).toLocaleString()
        : '—',
      isUnread: !readSet.has(String(announcement._id))
    }));

    return res.render('portal/announcements/index', {
      title: 'Announcements',
      layout: 'layout',
      announcements: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/announcements/:id', attachUser, requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    if (!ensureMember(req, res)) {
      return undefined;
    }

    const announcement = await models.Notification.findOne({
      _id: req.params.id,
      ...announcementQuery
    }).lean();

    if (!announcement) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const readRecord = await models.AnnouncementRead.findOne({
      memberId: req.member._id,
      notificationId: announcement._id
    }).lean();

    return res.render('portal/announcements/show', {
      title: buildAnnouncementTitle(announcement),
      layout: 'layout',
      announcement,
      publishedAtFormatted: announcement.publishedAt
        ? new Date(announcement.publishedAt).toLocaleString()
        : '—',
      isUnread: !readRecord
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/announcements/:id/read', attachUser, requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    if (!ensureMember(req, res)) {
      return undefined;
    }

    const announcement = await models.Notification.findOne({
      _id: req.params.id,
      ...announcementQuery
    }).lean();

    if (!announcement) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    await models.AnnouncementRead.updateOne(
      { memberId: req.member._id, notificationId: announcement._id },
      { $setOnInsert: { readAt: new Date() } },
      { upsert: true }
    );

    return res.redirect(`/portal/announcements/${announcement._id}`);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
