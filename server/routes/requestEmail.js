const express = require('express');
const { z } = require('zod');

const models = require('../models');

const router = express.Router();

const requestSchema = z.object({
  cid: z.string().min(1, 'CID is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Valid email is required.')
});

const normalizeLastName = (value) => String(value || '').trim().toLowerCase();

router.get('/request-email', (req, res) => {
  res.render('requests/request-email', {
    title: 'Request Email Access',
    layout: 'layout',
    errors: [],
    form: { cid: '', lastName: '', email: '' }
  });
});

router.post('/request-email', async (req, res, next) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).render('requests/request-email', {
        title: 'Request Email Access',
        layout: 'layout',
        errors: ['Please complete all fields with valid information.'],
        form: {
          cid: req.body?.cid || '',
          lastName: req.body?.lastName || '',
          email: req.body?.email || ''
        }
      });
    }

    const cid = String(parsed.data.cid).trim();
    const lastName = normalizeLastName(parsed.data.lastName);
    const requestedEmail = String(parsed.data.email).trim().toLowerCase();

    const member = await models.Member.findOne({ cid });
    if (!member || normalizeLastName(member.lastName) !== lastName) {
      return res.status(400).render('requests/request-email', {
        title: 'Request Email Access',
        layout: 'layout',
        errors: ['We could not verify your information. Please double-check and try again.'],
        form: {
          cid,
          lastName: parsed.data.lastName,
          email: requestedEmail
        }
      });
    }

    if (member.emailStatus === 'approved' && member.email === requestedEmail) {
      return res.render('requests/request-email-success', {
        title: 'Email Already Approved',
        layout: 'layout',
        message: 'That email address is already approved for portal access.'
      });
    }

    const existingPending = await models.EmailChangeRequest.findOne({
      memberId: member._id,
      requestedEmail,
      status: 'pending'
    });

    if (existingPending) {
      return res.render('requests/request-email-success', {
        title: 'Request Already Submitted',
        layout: 'layout',
        message: 'A request for that email is already pending review.'
      });
    }

    await models.EmailChangeRequest.create({
      memberId: member._id,
      requestedEmail,
      status: 'pending',
      requestedAt: new Date()
    });

    return res.render('requests/request-email-success', {
      title: 'Request Received',
      layout: 'layout',
      message: 'Your email access request has been submitted for review.'
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
