const express = require('express');
const NewsArticle = require('../../models/news-article');

const router = express.Router();
const PAGE_SIZE = 10;

router.get('/', async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  try {
    const [articles, total] = await Promise.all([
      NewsArticle.find({ published: true })
        .sort({ publishedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      NewsArticle.countDocuments({ published: true })
    ]);

    res.render('public/news-index', {
      title: 'News',
      layout: 'layout',
      articles,
      page,
      totalPages: Math.max(Math.ceil(total / PAGE_SIZE), 1)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const article = await NewsArticle.findOne({ slug: req.params.slug, published: true }).lean();
    if (!article) {
      return res.status(404).render('404', { title: 'Not Found', layout: 'layout' });
    }
    return res.render('public/news-show', {
      title: article.title,
      layout: 'layout',
      article
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
