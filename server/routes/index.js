const express = require('express');
const AuditLog = require('../models/auditLog');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Membership Portal',
    layout: 'layout'
  });
});

router.get('/about', (req, res) => {
  res.render('index', {
    title: 'About Local 1284',
    layout: 'layout'
  });
});

router.get('/admin/audit', requireAuth, requireRole(['admin', 'staff']), async (req, res, next) => {
  try {
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.render('admin-audit', {
      title: 'Audit Log',
      layout: 'layout',
      logs
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
