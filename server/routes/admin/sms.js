const express = require('express');
const Member = require('../../models/member');
const SmsMessage = require('../../models/sms-message');
const twilioClient = require('../../config/twilio');
const config = require('../../config');

const router = express.Router();

function buildFilter(body) {
  const { segmentType } = body;
  let query = { phone: { $exists: true, $ne: '' } };
  let summary = '';

  switch (segmentType) {
    case 'all-members':
      summary = 'all members with phone';
      break;
    case 'sms-group':
      query = { ...query, smsGroups: body.smsGroup };
      summary = `smsGroup=${body.smsGroup}`;
      break;
    case 'tags': {
      const tags = (body.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      query = { ...query, tags: { $in: tags } };
      summary = `tags=${tags.join(',')}`;
      break;
    }
    case 'filter':
    default:
      if (body.status) {
        query.status = body.status;
      }
      if (body.departmentNumber) {
        query.departmentNumber = body.departmentNumber;
      }
      if (body.seniorityFrom || body.seniorityTo) {
        query.seniorityDate = {};
        if (body.seniorityFrom) {
          query.seniorityDate.$gte = new Date(body.seniorityFrom);
        }
        if (body.seniorityTo) {
          query.seniorityDate.$lte = new Date(body.seniorityTo);
        }
      }
      summary = `filter status=${body.status || 'any'}, dept=${body.departmentNumber || 'any'}`;
      break;
  }

  return { query, summary, segmentType: segmentType || 'filter' };
}

router.get('/', async (req, res, next) => {
  try {
    const groups = await Member.distinct('smsGroups');
    res.render('admin/sms-compose', {
      title: 'Send SMS',
      layout: 'admin/layout-admin',
      groups
    });
  } catch (err) {
    next(err);
  }
});

router.post('/send', async (req, res, next) => {
  const { message } = req.body;
  if (!message || message.length > 480) {
    return res.status(400).render('admin/sms-compose', {
      title: 'Send SMS',
      layout: 'admin/layout-admin',
      error: 'Message is required and must be under 480 characters.',
      groups: await Member.distinct('smsGroups')
    });
  }

  if (!twilioClient) {
    return res.status(400).render('admin/sms-compose', {
      title: 'Send SMS',
      layout: 'admin/layout-admin',
      error: 'Twilio is not configured.',
      groups: await Member.distinct('smsGroups')
    });
  }

  try {
    const { query, summary, segmentType } = buildFilter(req.body);
    const members = await Member.find(query).lean();
    let success = 0;
    let failed = 0;

    for (const member of members) {
      try {
        const result = await twilioClient.messages.create({
          from: config.TWILIO_FROM_NUMBER,
          to: member.phone,
          body: message
        });

        await SmsMessage.create({
          to: member.phone,
          member: member._id,
          body: message,
          status: 'sent',
          twilioSid: result.sid,
          segmentType,
          segmentFilterSummary: summary,
          createdBy: req.session.user.id
        });

        await Member.findByIdAndUpdate(member._id, {
          $push: {
            communicationLog: {
              channel: 'sms',
              direction: 'outbound',
              message,
              meta: { twilioSid: result.sid },
              createdBy: req.session.user.id
            }
          }
        });
        success += 1;
      } catch (err) {
        failed += 1;
        await SmsMessage.create({
          to: member.phone,
          member: member._id,
          body: message,
          status: 'failed',
          errorMessage: err.message,
          segmentType,
          segmentFilterSummary: summary,
          createdBy: req.session.user.id
        });
      }
    }

    res.render('admin/sms-compose', {
      title: 'Send SMS',
      layout: 'admin/layout-admin',
      groups: await Member.distinct('smsGroups'),
      result: {
        matched: members.length,
        success,
        failed,
        segmentType,
        summary
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
