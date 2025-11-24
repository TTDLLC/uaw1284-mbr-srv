const express = require('express');
const Member = require('../../models/member');
const SmsMessage = require('../../models/sms-message');
const NewsArticle = require('../../models/news-article');
const { ensureAuthenticated, ensureRole, ensureSmsPermission } = require('../../middleware/auth');

const router = express.Router();
const authRoutes = require('./auth');
const memberRoutes = require('./members');
const newsRoutes = require('./news');
const smsRoutes = require('./sms');
const usersRoutes = require('./users');

router.use('/', authRoutes);

router.get('/', ensureAuthenticated, async (req, res, next) => {
  try {
    const [totalMembers, activeMembers, smsMessages, news] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: { $ne: 'INPRO' } }),
      SmsMessage.find().sort({ createdAt: -1 }).limit(5).lean(),
      NewsArticle.find().sort({ publishedAt: -1 }).limit(5).lean()
    ]);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      layout: 'admin/layout-admin',
      totalMembers,
      activeMembers,
      smsMessages,
      news
    });
  } catch (err) {
    next(err);
  }
});

router.use('/members', ensureAuthenticated, memberRoutes);
router.use('/news', ensureAuthenticated, newsRoutes);
router.use('/sms', ensureAuthenticated, ensureSmsPermission, smsRoutes);
router.use('/users', ensureAuthenticated, ensureRole('superadmin'), usersRoutes);

module.exports = router;
