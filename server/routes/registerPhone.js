const express = require('express');
const { z } = require('zod');

const config = require('../config');
const limiters = require('../middleware/limiters');
const { validateBody } = require('../middleware/validation');
const { normalizePhone, maskPhone } = require('../utils/phone');
const { generateOtp, hashOtp, timingSafeEqual, getExpiryDate, MAX_ATTEMPTS, OTP_TTL_MINUTES } = require('../utils/otp');
const { sendOtpSms } = require('../services/smsService');
const models = require('../models');

const router = express.Router();

const startSchema = z.object({
  cid: z.string().min(1, 'CID is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  phone: z.string().min(1, 'Phone number is required.')
});

const confirmSchema = z.object({
  code: z.string()
    .length(6, 'Verification code must be 6 digits.')
    .regex(/^\d{6}$/, 'Verification code must be 6 digits.')
});

const normalizeLastName = (value) => String(value || '').trim().toLowerCase();

const setPhoneRegSession = (req, payload) => {
  req.session.phoneReg = {
    ...payload,
    startedAt: new Date().toISOString()
  };
};

const clearPhoneRegSession = (req) => {
  if (req.session) {
    req.session.phoneReg = null;
  }
};

router.get('/phone', (req, res) => {
  clearPhoneRegSession(req);
  res.render('register/phone', {
    title: 'Register Phone',
    layout: 'layout',
    errors: [],
    form: {
      cid: '',
      lastName: '',
      phone: ''
    }
  });
});

router.post(
  '/phone/start',
  limiters.otpSend,
  validateBody(startSchema),
  async (req, res, next) => {
    try {
      const cid = String(req.body.cid || '').trim();
      const lastName = normalizeLastName(req.body.lastName);
      const phoneE164 = normalizePhone(req.body.phone);

      if (!phoneE164) {
        return res.status(400).render('register/phone', {
          title: 'Register Phone',
          layout: 'layout',
          errors: ['Please enter a valid US phone number.'],
          form: {
            cid,
            lastName: req.body.lastName || '',
            phone: req.body.phone || ''
          }
        });
      }

      const member = await models.Member.findOne({ cid });
      if (!member || normalizeLastName(member.lastName) !== lastName) {
        return res.status(400).render('register/phone', {
          title: 'Register Phone',
          layout: 'layout',
          errors: ['We could not verify your information. Please double-check and try again.'],
          form: {
            cid,
            lastName: req.body.lastName || '',
            phone: req.body.phone || ''
          }
        });
      }

      const code = generateOtp();
      const tokenHash = hashOtp(code, config.SESSION_SECRET);
      const expiresAt = getExpiryDate(OTP_TTL_MINUTES);

      await models.PhoneVerification.findOneAndUpdate(
        { memberId: member._id, phone: phoneE164 },
        {
          $set: {
            codeHash: tokenHash,
            expiresAt,
            attempts: 0,
            lastSentAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      setPhoneRegSession(req, {
        memberId: member._id.toString(),
        cid: member.cid,
        phoneE164
      });

      await sendOtpSms({
        toE164: phoneE164,
        code,
        memberId: member._id.toString(),
        cid: member.cid
      });

      return res.redirect('/register/phone/verify');
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/phone/verify', (req, res) => {
  const sessionData = req.session?.phoneReg;
  if (!sessionData?.memberId || !sessionData?.phoneE164) {
    return res.redirect('/register/phone');
  }
  res.render('register/phone-verify', {
    title: 'Verify Phone',
    layout: 'layout',
    errors: [],
    maskedPhone: maskPhone(sessionData.phoneE164)
  });
});

router.post(
  '/phone/confirm',
  limiters.otpConfirm,
  async (req, res, next) => {
    try {
      const parsed = confirmSchema.safeParse(req.body);
      if (!parsed.success) {
        const sessionData = req.session?.phoneReg;
        const maskedPhone = maskPhone(sessionData?.phoneE164);
        return res.status(400).render('register/phone-verify', {
          title: 'Verify Phone',
          layout: 'layout',
          errors: ['Please enter a 6-digit verification code.'],
          maskedPhone
        });
      }

      const sessionData = req.session?.phoneReg;
      if (!sessionData?.memberId || !sessionData?.phoneE164) {
        return res.redirect('/register/phone');
      }

      const member = await models.Member.findById(sessionData.memberId);
      if (!member || member.cid !== sessionData.cid) {
        clearPhoneRegSession(req);
        return res.redirect('/register/phone');
      }

      const verification = await models.PhoneVerification.findOne({
        memberId: member._id,
        phone: sessionData.phoneE164,
        expiresAt: { $gt: new Date() }
      });

      if (!verification) {
        clearPhoneRegSession(req);
        return res.status(400).render('register/phone-verify', {
          title: 'Verify Phone',
          layout: 'layout',
          errors: ['Verification expired. Please request a new code.'],
          maskedPhone: maskPhone(sessionData.phoneE164)
        });
      }

      if (verification.attempts >= MAX_ATTEMPTS) {
        return res.status(429).render('register/phone-verify', {
          title: 'Verify Phone',
          layout: 'layout',
          errors: ['Too many attempts. Please request a new code.'],
          maskedPhone: maskPhone(sessionData.phoneE164)
        });
      }

      const submittedCode = String(parsed.data.code || '').trim();
      const submittedHash = hashOtp(submittedCode, config.SESSION_SECRET);

      if (!timingSafeEqual(submittedHash, verification.codeHash)) {
        verification.attempts += 1;
        await verification.save();
        return res.status(400).render('register/phone-verify', {
          title: 'Verify Phone',
          layout: 'layout',
          errors: ['Invalid verification code. Please try again.'],
          maskedPhone: maskPhone(sessionData.phoneE164)
        });
      }

      member.phone = sessionData.phoneE164;
      member.phoneVerified = true;
      member.phoneVerifiedAt = new Date();
      member.smsOptIn = true;
      await member.save();

      await models.PhoneVerification.deleteOne({ _id: verification._id });

      clearPhoneRegSession(req);
      return res.render('register/phone-success', {
        title: 'Phone Verified',
        layout: 'layout'
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
