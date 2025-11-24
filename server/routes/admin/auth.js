const express = require('express');
const AdminUser = require('../../models/admin-user');
const { verifyPassword } = require('../../utils/password');

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('admin/login', { title: 'Admin Login', layout: 'layout' });
});

router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const adminUser = await AdminUser.findOne({ username }).lean();
    if (!adminUser || !adminUser.isActive) {
      return res.status(401).render('admin/login', {
        title: 'Admin Login',
        layout: 'layout',
        error: 'Invalid username or password.'
      });
    }

    const valid = await verifyPassword(password, adminUser.passwordHash);
    if (!valid) {
      return res.status(401).render('admin/login', {
        title: 'Admin Login',
        layout: 'layout',
        error: 'Invalid username or password.'
      });
    }

    req.session.user = {
      id: adminUser._id.toString(),
      username: adminUser.username,
      fullName: adminUser.fullName,
      role: adminUser.role,
      canSendSms: adminUser.canSendSms
    };

    return res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    return res.redirect('/admin/login');
  });
});

module.exports = router;
