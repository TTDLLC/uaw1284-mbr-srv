const express = require('express');
const router = express.Router();

router.use('/', require('./public/home'));
router.use('/news', require('./public/news'));
router.use('/about', require('./public/about'));
router.use('/admin', require('./admin'));

module.exports = router;
