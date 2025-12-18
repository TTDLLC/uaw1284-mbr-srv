const express = require('express');
const { z } = require('zod');

const limiters = require('../../middleware/limiters');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validateBody } = require('../../middleware/validation');

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
  (req, res) => {
    const { action, notes } = req.body;
    return res.json({
      ok: true,
      message: `Action "${action}" queued.`,
      notes: notes || null,
      requestId: req.id
    });
  }
);

module.exports = router;
