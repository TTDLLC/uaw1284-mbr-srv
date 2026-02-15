const express = require('express');
const { z } = require('zod');

const limiters = require('../../middleware/limiters');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validation');
const { logAction } = require('../../utils/audit');

const router = express.Router();

const adminActionSchema = z.object({
  action: z.enum(['archive-audit-log', 'refresh-directory', 'sync-members']),
  notes: z.string().max(500).optional()
});

router.post(
  '/actions',
  limiters.adminAction,
  requireAuth,
  requireRole(['admin']),
  validateBody(adminActionSchema),
  async (req, res, next) => {
    try {
      const { action, notes } = req.body;
      const user = req.user || req.session?.user;
      await logAction({
        actorUserId: user,
        action,
        targetType: 'admin',
        targetId: user?.id || null,
        metadata: {
          notes: notes || null
        },
        req
      });

      return res.json({
        ok: true,
        message: `Action "${action}" queued.`,
        notes: notes || null,
        requestId: req.id
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
