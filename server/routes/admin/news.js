const express = require('express');
const NewsArticle = require('../../models/news-article');
const { ensureRole } = require('../../middleware/auth');

const router = express.Router();
const PAGE_SIZE = 20;

function toSlug(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.get('/', async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  try {
    const [articles, total] = await Promise.all([
      NewsArticle.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      NewsArticle.countDocuments()
    ]);

    res.render('admin/news-list', {
      title: 'News',
      layout: 'admin/layout-admin',
      articles,
      page,
      totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/new', ensureRole('admin', 'superadmin'), (req, res) => {
  res.render('admin/news-edit', {
    title: 'New Article',
    layout: 'admin/layout-admin',
    article: {},
    mode: 'create'
  });
});

router.post('/', ensureRole('admin', 'superadmin'), async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (!payload.slug && payload.title) {
      payload.slug = toSlug(payload.title);
    }
    if (payload.published && !payload.publishedAt) {
      payload.publishedAt = new Date();
    }
    payload.createdBy = req.session.user.id;
    const article = new NewsArticle(payload);
    await article.save();
    res.redirect('/admin/news');
  } catch (err) {
    next(err);
  }
});

router.get('/:id/edit', ensureRole('admin', 'superadmin'), async (req, res, next) => {
  try {
    const article = await NewsArticle.findById(req.params.id).lean();
    if (!article) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }
    return res.render('admin/news-edit', {
      title: `Edit ${article.title}`,
      layout: 'admin/layout-admin',
      article,
      mode: 'edit'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id', ensureRole('admin', 'superadmin'), async (req, res, next) => {
  try {
    const article = await NewsArticle.findById(req.params.id);
    if (!article) {
      return res.status(404).render('404', { layout: 'layout', title: 'Not Found' });
    }

    article.title = req.body.title;
    article.slug = req.body.slug || toSlug(req.body.title);
    article.excerpt = req.body.excerpt;
    article.body = req.body.body;
    article.published = Boolean(req.body.published);
    article.publishedAt = req.body.publishedAt || (article.published ? new Date() : null);
    await article.save();
    res.redirect('/admin/news');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/delete', ensureRole('admin', 'superadmin'), async (req, res, next) => {
  try {
    await NewsArticle.findByIdAndDelete(req.params.id);
    res.redirect('/admin/news');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
