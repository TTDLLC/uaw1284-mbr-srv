const express = require('express');
const { z } = require('zod');

const models = require('../models');
const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { logMemberUpdate } = require('../utils/audit');

const router = express.Router();

const PAGE_SIZE = 25;

const buildSearchQuery = (query) => {
  if (!query) {
    return null;
  }
  const regex = new RegExp(query, 'i');
  return {
    $or: [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { cid: regex }
    ]
  };
};

const parsePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
};

const memberUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  departmentId: z.string().min(1, 'Department is required.'),
  phone: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'retired', 'left', 'pending'])
});

router.get('/members', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const department = String(req.query.department || '').trim();
    const page = parsePage(req.query.page);

    const filter = {};
    const searchQuery = buildSearchQuery(q);
    if (searchQuery) {
      Object.assign(filter, searchQuery);
    }
    if (department) {
      filter.departmentId = department;
    }

    const total = await models.Member.countDocuments(filter);
    const members = await models.Member.find(filter)
      .populate('departmentId')
      .sort({ lastName: 1, firstName: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();

    const departments = await models.Department.find({ active: true })
      .sort({ name: 1 })
      .lean();

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return res.render('portal/staff/members/index', {
      title: 'Member Directory',
      layout: 'layout',
      members,
      departments,
      q,
      department,
      page,
      total,
      totalPages
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/members/:id', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const member = await models.Member.findById(req.params.id).lean();
    if (!member) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const departments = await models.Department.find({ active: true })
      .sort({ name: 1 })
      .lean();

    return res.render('portal/staff/members/show', {
      title: 'Member Detail',
      layout: 'layout',
      member,
      departments,
      errors: [],
      success: null
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/members/:id', attachUser, requireAuth, requireRole('staff'), async (req, res, next) => {
  try {
    const member = await models.Member.findById(req.params.id);
    if (!member) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout', requestId: req.id });
    }

    const parsed = memberUpdateSchema.safeParse({
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
      departmentId: req.body?.departmentId,
      phone: req.body?.phone || '',
      status: req.body?.status
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.issues.map((issue) => issue.message);
      const departments = await models.Department.find({ active: true })
        .sort({ name: 1 })
        .lean();
      const memberView = { ...member.toObject(), ...req.body };
      return res.status(400).render('portal/staff/members/show', {
        title: 'Member Detail',
        layout: 'layout',
        member: memberView,
        departments,
        errors: fieldErrors.length ? fieldErrors : ['Please complete all required fields.'],
        success: null
      });
    }

    const before = {
      firstName: member.firstName,
      lastName: member.lastName,
      departmentId: member.departmentId?.toString() || '',
      phone: member.phone || '',
      status: member.status || ''
    };

    const nextData = parsed.data;
    const nextPhone = nextData.phone ? String(nextData.phone).trim() : '';
    const phoneChanged = (member.phone || '') !== nextPhone;

    member.firstName = nextData.firstName;
    member.lastName = nextData.lastName;
    member.departmentId = nextData.departmentId;
    member.phone = nextPhone;
    member.status = nextData.status;

    if (phoneChanged) {
      member.phoneVerified = false;
      member.phoneVerifiedAt = null;
      member.smsOptIn = false;
    }

    await member.save();

    const after = {
      firstName: member.firstName,
      lastName: member.lastName,
      departmentId: member.departmentId?.toString() || '',
      phone: member.phone || '',
      status: member.status || ''
    };

    await logMemberUpdate({
      actorUser: req.user || req.session?.user,
      memberId: member._id,
      before,
      after,
      ipAddress: req.ip
    });

    const departments = await models.Department.find({ active: true })
      .sort({ name: 1 })
      .lean();

    return res.render('portal/staff/members/show', {
      title: 'Member Detail',
      layout: 'layout',
      member: member.toObject(),
      departments,
      errors: [],
      success: 'Member updated successfully.'
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
