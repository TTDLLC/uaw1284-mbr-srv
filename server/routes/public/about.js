const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  const leadership = [
    { name: 'John Doe', role: 'President' },
    { name: 'Jane Smith', role: 'Vice President' },
    { name: 'Alex Johnson', role: 'Recording Secretary' }
  ];

  const contact = {
    address: '123 Union Hall Way, Auburn Hills, MI',
    phone: '(555) 555-1234',
    email: 'info@uaw1284.org'
  };

  res.render('public/about', {
    title: 'About UAW Local 1284',
    layout: 'layout',
    leadership,
    contact
  });
});

module.exports = router;
