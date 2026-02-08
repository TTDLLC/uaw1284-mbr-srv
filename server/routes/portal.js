const express = require('express');

const attachUser = require('../middleware/attachUser');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/', attachUser, requireAuth, (req, res) => {
  const user = res.locals.user || req.user || req.session?.user || null;
  res.render('portal/index', {
    title: 'Member Portal',
    layout: 'layout',
    user
  });
});

module.exports = router;
