const express = require('express');
const AdminUser = require('../../models/admin-user');
const { hashPassword } = require('../../utils/password');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const users = await AdminUser.find().sort({ username: 1 }).lean();
    res.render('admin/users-list', {
      title: 'Admin Users',
      layout: 'admin/layout-admin',
      users
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', (_req, res) => {
  res.render('admin/users-edit', {
    title: 'New Admin User',
    layout: 'admin/layout-admin',
    user: {},
    mode: 'create'
  });
});

router.post('/', async (req, res, next) => {
  try {
    const passwordHash = await hashPassword(req.body.password);
    const user = new AdminUser({
      username: req.body.username,
      passwordHash,
      fullName: req.body.fullName,
      email: req.body.email,
      role: req.body.role,
      canSendSms: Boolean(req.body.canSendSms),
      isActive: Boolean(req.body.isActive)
    });
    await user.save();
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.params.id).lean();
    if (!user) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }
    return res.render('admin/users-edit', {
      title: `Edit ${user.username}`,
      layout: 'admin/layout-admin',
      user,
      mode: 'edit'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }
    user.fullName = req.body.fullName;
    user.email = req.body.email;
    user.role = req.body.role;
    user.canSendSms = Boolean(req.body.canSendSms);
    user.isActive = Boolean(req.body.isActive);
    if (req.body.password) {
      user.passwordHash = await hashPassword(req.body.password);
    }
    await user.save();
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deactivate', async (req, res, next) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
