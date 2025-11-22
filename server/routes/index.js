const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Template Home',
    layout: 'layout'
  });
});

router.get('/about', (req, res) => {
  res.render('index', {
    title: 'About',
    layout: 'layout'
  });
});

module.exports = router;

