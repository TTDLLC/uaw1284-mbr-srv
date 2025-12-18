const express = require('express');
const { z } = require('zod');

const limiters = require('../../middleware/limiters');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validation');
const { logEvent } = require('../../services/auditTrail');

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
      await logEvent({
        action,
        entityType: 'admin',
        entityId: user?.id || 'unknown',
        metadata: {
          notes: notes || null
        },
        actor: {
          id: user?.id || null,
          email: user?.email || null,
          role: user?.role || null
        },
        ipAddress: req.ip
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
