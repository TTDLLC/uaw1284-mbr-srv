const express = require('express');
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

router.get('/admin/audit', requireAuth, requireRole(['admin', 'staff']), (req, res) => {
  res.redirect('/portal/staff/audit');
});

module.exports = router;
