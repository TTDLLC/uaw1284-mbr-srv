const express = require('express');
const { z } = require('zod');

const limiters = require('../../middleware/limiters');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validation');
const Member = require('../../models/member');
const { logMemberChange, logDataExport } = require('../../services/auditTrail');

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
  const user = req.user || req.session?.user;
  if (!user) {
    return null;
  }
  return { id: user.id, email: user.email, role: user.role };
}

router.post(
  '/',
  limiters.adminAction,
  requireAuth,
  requireRole(['admin', 'staff']),
  validateBody(createMemberSchema),
  async (req, res, next) => {
    try {
      const payload = parseMemberPayload(req.body);
      const member = await Member.create(payload);
      await logMemberChange({
        actor: actorFromRequest(req),
        memberId: member.id,
        action: 'member.create',
        before: null,
        after: member.toObject(),
        ipAddress: req.ip,
        notes: 'Member created via API'
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
  requireRole(['admin', 'staff']),
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
      await logMemberChange({
        actor: actorFromRequest(req),
        memberId: member.id,
        action: 'member.update',
        before,
        after: member.toObject(),
        ipAddress: req.ip,
        notes: 'Member updated via API'
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
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const member = await Member.findById(req.params.memberId);
      if (!member) {
        return res.status(404).json({ ok: false, message: 'Member not found', requestId: req.id });
      }
      const before = member.toObject();
      await Member.deleteOne({ _id: member.id });
      await logMemberChange({
        actor: actorFromRequest(req),
        memberId: member.id,
        action: 'member.delete',
        before,
        after: null,
        ipAddress: req.ip,
        notes: 'Member deleted via API'
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
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      const members = await Member.find(filter).limit(100).lean();
      await logDataExport({
        actor: actorFromRequest(req),
        format: 'json',
        filter,
        count: members.length,
        ipAddress: req.ip
      });
      return res.json({ ok: true, count: members.length, members, requestId: req.id });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
