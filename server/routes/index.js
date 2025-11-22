const express = require('express');
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

module.exports = router;
