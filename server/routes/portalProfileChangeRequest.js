const express = require('express');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { normalizePhone, maskPhone } = require('../utils/phone');

const router = express.Router();

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const buildFormData = (member, body = {}) => ({
  firstName: body.firstName ?? member?.firstName ?? '',
  lastName: body.lastName ?? member?.lastName ?? '',
  phone: body.phone ?? member?.phone ?? '',
  departmentId: body.departmentId ?? (member?.departmentId ? String(member.departmentId) : '')
});

const ensureMember = (req, res) => {
  if (!req.member) {
    res.status(403).render('403', {
      title: 'Access Denied',
      layout: 'layout',
      requestId: req.id,
      msg: 'Member profile required to request changes.'
    });
    return false;
  }
  return true;
};

const getDepartments = () => models.Department.find({ active: true }).sort({ name: 1 }).lean();

const buildChanges = async ({ member, body }) => {
  const changes = {};
  const errors = [];

  const requestedFirstName = normalizeText(body.firstName);
  const requestedLastName = normalizeText(body.lastName);

  if (requestedFirstName && requestedFirstName !== normalizeText(member.firstName)) {
    changes.firstName = requestedFirstName;
  }

  if (requestedLastName && requestedLastName !== normalizeText(member.lastName)) {
    changes.lastName = requestedLastName;
  }

  const requestedPhoneRaw = normalizeText(body.phone);
  if (requestedPhoneRaw) {
    const normalizedPhone = normalizePhone(requestedPhoneRaw);
    if (!normalizedPhone) {
      errors.push('Phone number must be a valid US phone number.');
    } else if (normalizedPhone !== member.phone) {
      changes.phone = normalizedPhone;
    }
  }

  const requestedDepartmentId = normalizeText(body.departmentId);
  if (requestedDepartmentId) {
    const department = await models.Department.findById(requestedDepartmentId).lean();
    if (!department) {
      errors.push('Selected department is not valid.');
    } else if (!member.departmentId || String(member.departmentId) !== String(department._id)) {
      changes.departmentId = String(department._id);
    }
  }

  return { changes, errors };
};

const formatPendingChanges = async ({ member, changes }) => {
  if (!changes) {
    return [];
  }
  const rows = [];
  if (changes.firstName) {
    rows.push({
      label: 'First name',
      current: member?.firstName || '—',
      requested: changes.firstName
    });
  }
  if (changes.lastName) {
    rows.push({
      label: 'Last name',
      current: member?.lastName || '—',
      requested: changes.lastName
    });
  }
  if (changes.phone) {
    rows.push({
      label: 'Phone',
      current: member?.phone ? maskPhone(member.phone) : '—',
      requested: maskPhone(changes.phone)
    });
  }
  if (changes.departmentId) {
    const department = await models.Department.findById(changes.departmentId).lean();
    const currentDepartment = member?.departmentId
      ? await models.Department.findById(member.departmentId).lean()
      : null;
    rows.push({
      label: 'Department',
      current: currentDepartment?.name || '—',
      requested: department?.name || changes.departmentId
    });
  }
  return rows;
};

router.get('/profile/change-request', attachUser, requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    if (!ensureMember(req, res)) {
      return undefined;
    }

    const pendingRequest = await models.MemberChangeRequest.findOne({
      memberId: req.member._id,
      status: 'pending'
    })
      .sort({ submittedAt: -1 })
      .lean();

    if (pendingRequest) {
      const pendingChanges = await formatPendingChanges({
        member: req.member,
        changes: pendingRequest.changes
      });
      return res.render('portal/profile/change-request-pending', {
        title: 'Profile Change Request',
        layout: 'layout',
        submittedAtFormatted: pendingRequest.submittedAt
          ? new Date(pendingRequest.submittedAt).toLocaleString()
          : '—',
        changes: pendingChanges
      });
    }

    const departments = await getDepartments();

    return res.render('portal/profile/change-request', {
      title: 'Request Profile Update',
      layout: 'layout',
      form: buildFormData(req.member),
      departments,
      errors: []
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/profile/change-request', attachUser, requireAuth, requireRole('member'), async (req, res, next) => {
  try {
    if (!ensureMember(req, res)) {
      return undefined;
    }

    const pendingRequest = await models.MemberChangeRequest.findOne({
      memberId: req.member._id,
      status: 'pending'
    })
      .sort({ submittedAt: -1 })
      .lean();

    if (pendingRequest) {
      const pendingChanges = await formatPendingChanges({
        member: req.member,
        changes: pendingRequest.changes
      });
      return res.render('portal/profile/change-request-pending', {
        title: 'Profile Change Request',
        layout: 'layout',
        submittedAtFormatted: pendingRequest.submittedAt
          ? new Date(pendingRequest.submittedAt).toLocaleString()
          : '—',
        changes: pendingChanges
      });
    }

    const departments = await getDepartments();
    const { changes, errors } = await buildChanges({ member: req.member, body: req.body });

    if (errors.length) {
      return res.status(400).render('portal/profile/change-request', {
        title: 'Request Profile Update',
        layout: 'layout',
        form: buildFormData(req.member, req.body),
        departments,
        errors
      });
    }

    if (!Object.keys(changes).length) {
      return res.status(400).render('portal/profile/change-request', {
        title: 'Request Profile Update',
        layout: 'layout',
        form: buildFormData(req.member, req.body),
        departments,
        errors: ['No changes detected. Update at least one field before submitting.']
      });
    }

    await models.MemberChangeRequest.create({
      memberId: req.member._id,
      requestedByUserId: req.user?._id || req.user?.id,
      changes,
      status: 'pending',
      submittedAt: new Date()
    });

    return res.render('portal/profile/change-request-success', {
      title: 'Request Submitted',
      layout: 'layout'
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
