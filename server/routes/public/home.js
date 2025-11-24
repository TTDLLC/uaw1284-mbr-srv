const express = require('express');
const NewsArticle = require('../../models/news-article');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const news = await NewsArticle.find({ published: true })
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();

    res.render('public/home', {
      title: 'UAW Local 1284',
      layout: 'layout',
      news
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
