const express = require('express');
const { z } = require('zod');

const limiters = require('../../middleware/limiters');
const { requireAuth } = require('../../middleware/auth');
const requirePermission = require('../../middleware/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');
const { validateBody } = require('../../middleware/validation');
const Member = require('../../models/member');
const { logAction } = require('../../utils/audit');

const router = express.Router();

const memberStatusEnum = z.enum(['active', 'retired', 'left', 'pending']);

const addressSchema = z.object({
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().optional()
}).optional();

const baseMemberSchema = z.object({
  cid: z.string().min(1),
  uid: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: memberStatusEnum.optional(),
  joinDate: z.string().or(z.date()).optional(),
  unit: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  address: addressSchema
});

const createMemberSchema = baseMemberSchema;
const updateMemberSchema = baseMemberSchema.partial();

function parseMemberPayload(payload) {
  const data = { ...payload };
  if (data.joinDate) {
    data.joinDate = new Date(data.joinDate);
  }
  return data;
}

function actorFromRequest(req) {
  return req.user || req.session?.user || null;
}

router.post(
  '/',
  limiters.adminAction,
  requireAuth,
  requirePermission(PERMISSIONS.MEMBERS_WRITE),
  validateBody(createMemberSchema),
  async (req, res, next) => {
    try {
      const payload = parseMemberPayload(req.body);
      const member = await Member.create(payload);
      await logAction({
        actorUserId: actorFromRequest(req),
        action: 'member.create',
        targetType: 'member',
        targetId: member._id,
        metadata: {
          notes: 'Member created via API'
        },
        req
      });
      return res.status(201).json({ ok: true, member, requestId: req.id });
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/:memberId',
  limiters.adminAction,
  requireAuth,
  requirePermission(PERMISSIONS.MEMBERS_WRITE),
  validateBody(updateMemberSchema),
  async (req, res, next) => {
    try {
      const member = await Member.findById(req.params.memberId);
      if (!member) {
        return res.status(404).json({ ok: false, message: 'Member not found', requestId: req.id });
      }
      const before = member.toObject();
      const updates = parseMemberPayload(req.body);
      Object.assign(member, updates);
      await member.save();
      await logAction({
        actorUserId: actorFromRequest(req),
        action: 'member.update',
        targetType: 'member',
        targetId: member._id,
        metadata: {
          notes: 'Member updated via API',
          changedFields: Object.keys(updates || {})
        },
        req
      });
      return res.json({ ok: true, member, requestId: req.id });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:memberId',
  limiters.adminAction,
  requireAuth,
  requirePermission(PERMISSIONS.MEMBERS_WRITE),
  async (req, res, next) => {
    try {
      const member = await Member.findById(req.params.memberId);
      if (!member) {
        return res.status(404).json({ ok: false, message: 'Member not found', requestId: req.id });
      }
      await Member.deleteOne({ _id: member.id });
      await logAction({
        actorUserId: actorFromRequest(req),
        action: 'member.delete',
        targetType: 'member',
        targetId: member._id,
        metadata: {
          notes: 'Member deleted via API'
        },
        req
      });
      return res.json({ ok: true, requestId: req.id });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/export',
  limiters.adminAction,
  requireAuth,
  requirePermission(PERMISSIONS.MEMBERS_READ),
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      const members = await Member.find(filter).limit(100).lean();
      await logAction({
        actorUserId: actorFromRequest(req),
        action: 'member.export',
        targetType: 'member',
        targetId: null,
        metadata: {
          format: 'json',
          filter,
          count: members.length
        },
        req
      });
      return res.json({ ok: true, count: members.length, members, requestId: req.id });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
