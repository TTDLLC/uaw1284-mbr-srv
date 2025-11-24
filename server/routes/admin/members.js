const express = require('express');
const Member = require('../../models/member');
const AdminUser = require('../../models/admin-user');
const { ensureRole } = require('../../middleware/auth');

const router = express.Router();
const PAGE_SIZE = 20;

function parseListField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => v.trim()).filter(Boolean);
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

router.get('/', async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const query = {};

  if (req.query.name) {
    const regex = new RegExp(req.query.name, 'i');
    query.$or = [{ firstName: regex }, { lastName: regex }];
  }
  if (req.query.cid) {
    query.cid = req.query.cid.trim();
  }
  if (req.query.uid) {
    query.uid = req.query.uid.trim();
  }
  if (req.query.status) {
    query.status = req.query.status;
  }
  if (req.query.departmentNumber) {
    query.departmentNumber = req.query.departmentNumber.trim();
  }
  if (req.query.smsGroup) {
    query.smsGroups = req.query.smsGroup;
  }
  if (req.query.tag) {
    query.tags = req.query.tag;
  }

  try {
    const [members, total] = await Promise.all([
      Member.find(query)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Member.countDocuments(query)
    ]);

    res.render('admin/members-list', {
      title: 'Members',
      layout: 'admin/layout-admin',
      members,
      page,
      totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
      filters: req.query
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', ensureRole('admin', 'superadmin'), (req, res) => {
  res.render('admin/members-edit', {
    title: 'New Member',
    layout: 'admin/layout-admin',
    member: {},
    mode: 'create',
    role: req.session.user.role,
    communicationLog: []
  });
});

router.post('/', ensureRole('admin', 'superadmin'), async (req, res, next) => {
  try {
    const payload = { ...req.body };
    payload.tags = parseListField(req.body.tags);
    payload.smsGroups = parseListField(req.body.smsGroups);
    const member = new Member(payload);
    await member.save();
    res.redirect(`/admin/members/${member._id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id).lean();
    if (!member) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }

    const communicationLog = (member.communicationLog || []).slice(-10).reverse();
    const createdByIds = communicationLog.map((log) => log.createdBy).filter(Boolean);
    let createdByMap = {};
    if (createdByIds.length) {
      const users = await AdminUser.find({ _id: { $in: createdByIds } }).lean();
      createdByMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = user;
        return acc;
      }, {});
    }

    res.render('admin/members-edit', {
      title: `${member.firstName} ${member.lastName}`,
      layout: 'admin/layout-admin',
      member,
      role: req.session.user.role,
      mode: 'edit',
      communicationLog,
      createdByMap
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }

    const role = req.session.user.role;
    if (role === 'readonly') {
      return res.status(403).render('500', {
        title: 'Forbidden',
        layout: 'layout',
        msg: 'Read-only users cannot update members.'
      });
    }

    const allowedFields = new Set([
      'firstName',
      'lastName',
      'cid',
      'uid',
      'email',
      'phone',
      'seniorityDate',
      'status',
      'departmentNumber',
      'departmentName',
      'internalNotes',
      'tags',
      'smsGroups',
      'address.street',
      'address.city',
      'address.state',
      'address.zip'
    ]);

    if (role === 'steward') {
      allowedFields.clear();
      ['departmentNumber', 'departmentName', 'status', 'internalNotes', 'tags', 'smsGroups'].forEach((f) =>
        allowedFields.add(f)
      );
    }

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.has(key)) {
        updates[key] = req.body[key];
      }
    });

    if (allowedFields.has('tags')) {
      updates.tags = parseListField(req.body.tags);
    }
    if (allowedFields.has('smsGroups')) {
      updates.smsGroups = parseListField(req.body.smsGroups);
    }

    Object.keys(updates).forEach((key) => {
      if (key.startsWith('address.')) {
        const [, field] = key.split('.');
        member.address = member.address || {};
        member.address[field] = updates[key];
      } else {
        member[key] = updates[key];
      }
    });

    if (req.body.logMessage) {
      member.communicationLog.push({
        channel: req.body.logChannel || 'other',
        direction: req.body.logDirection || 'outbound',
        subject: req.body.logSubject,
        message: req.body.logMessage,
        createdBy: req.session.user.id
      });
    }

    await member.save();
    res.redirect(`/admin/members/${member._id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
