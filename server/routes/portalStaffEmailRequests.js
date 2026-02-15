const express = require('express');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../config/permissions');
const { logAction } = require('../utils/audit');

const router = express.Router();

const buildDisplayName = (member) => {
  if (!member) {
    return 'Unknown Member';
  }
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.cid || 'Member';
};

router.get('/email-requests', attachUser, requireAuth, requirePermission(PERMISSIONS.EMAIL_REQUESTS_REVIEW), async (req, res, next) => {
  try {
    const pendingRequests = await models.EmailChangeRequest.find({ status: 'pending' })
      .sort({ requestedAt: -1 })
      .limit(100)
      .lean();

    const reviewedRequests = await models.EmailChangeRequest.find({
      status: { $in: ['approved', 'rejected'] }
    })
      .sort({ requestedAt: -1 })
      .limit(100)
      .lean();

    const requests = [...pendingRequests, ...reviewedRequests];

    const memberIds = requests.map((request) => request.memberId).filter(Boolean);
    const members = await models.Member.find({ _id: { $in: memberIds } })
      .lean();

    const memberMap = new Map(members.map((member) => [String(member._id), member]));

    const rows = requests.map((request) => {
      const member = memberMap.get(String(request.memberId));
      return {
        id: request._id,
        requestedEmail: request.requestedEmail,
        status: request.status,
        statusLabel: request.status === 'pending' ? 'Pending' : request.status === 'approved' ? 'Approved' : 'Rejected',
        requestedAtFormatted: request.requestedAt ? new Date(request.requestedAt).toLocaleString() : '—',
        memberName: buildDisplayName(member),
        cid: member?.cid || '—'
      };
    });

    return res.render('portal/staff/email-requests', {
      title: 'Email Requests',
      layout: 'layout',
      requests: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/email-requests/:id/approve', attachUser, requireAuth, requirePermission(PERMISSIONS.EMAIL_REQUESTS_REVIEW), async (req, res, next) => {
  try {
    const request = await models.EmailChangeRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.redirect('/portal/staff/email-requests');
    }

    const reviewer = req.user || req.session?.user;
    request.status = 'approved';
    request.reviewedByUserId = reviewer?._id || reviewer?.id || null;
    request.reviewedAt = new Date();
    await request.save();

    const member = await models.Member.findById(request.memberId);
    if (member) {
      member.email = request.requestedEmail;
      member.emailStatus = 'approved';
      member.emailApprovedByUserId = reviewer?._id || reviewer?.id || null;
      member.emailApprovedAt = new Date();
      await member.save();

      let user = await models.User.findOne({ memberId: member._id });
      if (!user) {
        user = await models.User.create({
          memberId: member._id,
          email: request.requestedEmail,
          role: 'member',
          isActive: true
        });
      } else {
        user.email = request.requestedEmail;
        user.role = user.role || 'member';
        user.isActive = user.isActive !== false;
        await user.save();
      }
    }

    await logAction({
      actorUserId: reviewer,
      action: 'emailRequest.approve',
      targetType: 'emailChangeRequest',
      targetId: request._id,
      metadata: {
        requestedEmail: request.requestedEmail,
        memberId: request.memberId ? String(request.memberId) : null
      },
      req
    });

    return res.redirect('/portal/staff/email-requests');
  } catch (err) {
    return next(err);
  }
});

router.post('/email-requests/:id/reject', attachUser, requireAuth, requirePermission(PERMISSIONS.EMAIL_REQUESTS_REVIEW), async (req, res, next) => {
  try {
    const request = await models.EmailChangeRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.redirect('/portal/staff/email-requests');
    }

    const reviewer = req.user || req.session?.user;
    request.status = 'rejected';
    request.reviewedByUserId = reviewer?._id || reviewer?.id || null;
    request.reviewedAt = new Date();
    await request.save();

    await logAction({
      actorUserId: reviewer,
      action: 'emailRequest.reject',
      targetType: 'emailChangeRequest',
      targetId: request._id,
      metadata: {
        requestedEmail: request.requestedEmail,
        memberId: request.memberId ? String(request.memberId) : null
      },
      req
    });

    return res.redirect('/portal/staff/email-requests');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
