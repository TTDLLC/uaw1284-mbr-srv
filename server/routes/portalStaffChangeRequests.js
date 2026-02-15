const express = require('express');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { logMemberUpdate, logMemberChangeRequestDecision } = require('../utils/audit');
const { maskPhone } = require('../utils/phone');

const router = express.Router();

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const buildMemberName = (member) => {
  if (!member) {
    return 'Unknown Member';
  }
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.cid || 'Member';
};

const buildChangesSummary = (changes, departmentMap) => {
  const summary = [];
  if (changes.firstName) {
    summary.push('First name');
  }
  if (changes.lastName) {
    summary.push('Last name');
  }
  if (changes.phone) {
    summary.push('Phone');
  }
  if (changes.departmentId) {
    const deptName = departmentMap.get(String(changes.departmentId));
    summary.push(deptName ? `Department (${deptName})` : 'Department');
  }
  return summary.length ? summary.join(', ') : '—';
};

const buildChangeRows = (member, changes, departments) => {
  const deptMap = new Map(departments.map((dept) => [String(dept._id), dept.name]));
  const rows = [];

  if (changes.firstName) {
    rows.push({
      label: 'First name',
      current: member.firstName || '—',
      requested: changes.firstName
    });
  }
  if (changes.lastName) {
    rows.push({
      label: 'Last name',
      current: member.lastName || '—',
      requested: changes.lastName
    });
  }
  if (changes.phone) {
    rows.push({
      label: 'Phone',
      current: member.phone ? maskPhone(member.phone) : '—',
      requested: maskPhone(changes.phone)
    });
  }
  if (changes.departmentId) {
    rows.push({
      label: 'Department',
      current: deptMap.get(String(member.departmentId)) || '—',
      requested: deptMap.get(String(changes.departmentId)) || changes.departmentId
    });
  }

  return rows;
};

const buildBeforeAfterSnapshots = (member, changes) => {
  const before = {
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    departmentId: member.departmentId ? String(member.departmentId) : null,
    phoneVerified: member.phoneVerified,
    phoneVerifiedAt: member.phoneVerifiedAt ? member.phoneVerifiedAt.toISOString() : null,
    smsOptIn: member.smsOptIn
  };

  const after = { ...before };

  if (changes.firstName) {
    after.firstName = changes.firstName;
  }
  if (changes.lastName) {
    after.lastName = changes.lastName;
  }
  if (changes.phone) {
    after.phone = changes.phone;
    after.phoneVerified = false;
    after.phoneVerifiedAt = null;
    after.smsOptIn = false;
  }
  if (changes.departmentId) {
    after.departmentId = String(changes.departmentId);
  }

  return { before, after };
};

router.get('/change-requests', attachUser, requireAuth, requireRole('staff'), async (_req, res, next) => {
  try {
    const pendingRequests = await models.MemberChangeRequest.find({ status: 'pending' })
      .sort({ submittedAt: -1 })
      .limit(100)
      .lean();

    const memberIds = pendingRequests.map((request) => request.memberId);
    const members = memberIds.length
      ? await models.Member.find({ _id: { $in: memberIds } }).lean()
      : [];

    const departmentIds = members
      .map((member) => member.departmentId)
      .filter(Boolean)
      .map((id) => String(id));

    const requestedDepartmentIds = pendingRequests
      .map((request) => request.changes?.departmentId)
      .filter(Boolean)
      .map((id) => String(id));

    const departments = [...new Set([...departmentIds, ...requestedDepartmentIds])];
    const departmentDocs = departments.length
      ? await models.Department.find({ _id: { $in: departments } }).lean()
      : [];

    const departmentMap = new Map(departmentDocs.map((dept) => [String(dept._id), dept.name]));
    const memberMap = new Map(members.map((member) => [String(member._id), member]));

    const rows = pendingRequests.map((request) => {
      const member = memberMap.get(String(request.memberId));
      return {
        id: request._id,
        memberName: buildMemberName(member),
        cid: member?.cid || '—',
        submittedAtFormatted: request.submittedAt
          ? new Date(request.submittedAt).toLocaleString()
          : '—',
        changesSummary: buildChangesSummary(request.changes || {}, departmentMap)
      };
    });

    return res.render('portal/staff/change-requests/index', {
      title: 'Change Requests',
      layout: 'layout',
      requests: rows
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/change-requests/:id', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const changeRequest = await models.MemberChangeRequest.findById(req.params.id).lean();
    if (!changeRequest) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const member = await models.Member.findById(changeRequest.memberId).lean();
    if (!member) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const departments = await models.Department.find({})
      .sort({ name: 1 })
      .lean();

    const changeRows = buildChangeRows(member, changeRequest.changes || {}, departments);

    return res.render('portal/staff/change-requests/show', {
      title: 'Change Request',
      layout: 'layout',
      request: changeRequest,
      member,
      memberName: buildMemberName(member),
      changeRows,
      departments,
      submittedAtFormatted: changeRequest.submittedAt
        ? new Date(changeRequest.submittedAt).toLocaleString()
        : '—',
      reviewedAtFormatted: changeRequest.reviewedAt
        ? new Date(changeRequest.reviewedAt).toLocaleString()
        : '—'
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/change-requests/:id/approve', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const changeRequest = await models.MemberChangeRequest.findById(req.params.id);
    if (!changeRequest || changeRequest.status !== 'pending') {
      return res.redirect('/portal/staff/change-requests');
    }

    const member = await models.Member.findById(changeRequest.memberId);
    if (!member) {
      return res.redirect('/portal/staff/change-requests');
    }

    const reviewer = req.user || req.session?.user;
    const note = normalizeText(req.body.note);

    const { before, after } = buildBeforeAfterSnapshots(member, changeRequest.changes || {});

    if (changeRequest.changes?.departmentId) {
      const departmentExists = await models.Department.exists({ _id: changeRequest.changes.departmentId });
      if (!departmentExists) {
        const departments = await models.Department.find({}).sort({ name: 1 }).lean();
        return res.status(400).render('portal/staff/change-requests/show', {
          title: 'Change Request',
          layout: 'layout',
          request: changeRequest,
          member,
          memberName: buildMemberName(member),
          changeRows: buildChangeRows(member, changeRequest.changes || {}, departments),
          departments,
          submittedAtFormatted: changeRequest.submittedAt
            ? new Date(changeRequest.submittedAt).toLocaleString()
            : '—',
          reviewedAtFormatted: '—',
          errors: ['Requested department is no longer available.']
        });
      }
    }

    if (changeRequest.changes?.firstName) {
      member.firstName = changeRequest.changes.firstName;
    }
    if (changeRequest.changes?.lastName) {
      member.lastName = changeRequest.changes.lastName;
    }
    if (changeRequest.changes?.phone) {
      member.phone = changeRequest.changes.phone;
      member.phoneVerified = false;
      member.smsOptIn = false;
      member.phoneVerifiedAt = null;
    }
    if (changeRequest.changes?.departmentId) {
      member.departmentId = changeRequest.changes.departmentId;
    }

    await member.save();
    await logMemberUpdate({
      actorUser: reviewer,
      memberId: member._id,
      before,
      after,
      req
    });

    changeRequest.status = 'approved';
    changeRequest.reviewedByUserId = reviewer?._id || reviewer?.id || null;
    changeRequest.reviewedAt = new Date();
    changeRequest.note = note || changeRequest.note || null;
    await changeRequest.save();

    await logMemberChangeRequestDecision({
      actorUser: reviewer,
      memberId: member._id,
      requestId: changeRequest._id,
      decision: 'approve',
      note,
      req
    });

    return res.redirect(`/portal/staff/change-requests/${changeRequest._id}`);
  } catch (err) {
    return next(err);
  }
});

router.post('/change-requests/:id/reject', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const changeRequest = await models.MemberChangeRequest.findById(req.params.id);
    if (!changeRequest || changeRequest.status !== 'pending') {
      return res.redirect('/portal/staff/change-requests');
    }

    const reviewer = req.user || req.session?.user;
    const note = normalizeText(req.body.note);

    changeRequest.status = 'rejected';
    changeRequest.reviewedByUserId = reviewer?._id || reviewer?.id || null;
    changeRequest.reviewedAt = new Date();
    changeRequest.note = note || changeRequest.note || null;
    await changeRequest.save();

    await logMemberChangeRequestDecision({
      actorUser: reviewer,
      memberId: changeRequest.memberId,
      requestId: changeRequest._id,
      decision: 'reject',
      note,
      req
    });

    return res.redirect(`/portal/staff/change-requests/${changeRequest._id}`);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
