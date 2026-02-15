const express = require('express');
const { requireAuth } = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

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

router.get('/admin/audit', requireAuth, requirePermission(PERMISSIONS.AUDIT_READ), (req, res) => {
  res.redirect('/portal/staff/audit');
});

module.exports = router;
