const config = require('../config');

let twilioClient = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(
      config.providers.sms.twilioAccountSid,
      config.providers.sms.twilioAuthToken
    );
  }
  return twilioClient;
};

const sendOtpSms = async ({ toE164, code, memberId, cid }) => {
  if (config.providers.sms.provider === 'twilio') {
    const client = getTwilioClient();
    await client.messages.create({
      to: toE164,
      from: config.providers.sms.twilioFromNumber,
      body: `Your UAW Local 1284 verification code is ${code}.`
    });
    return { ok: true, provider: 'twilio' };
  }

  console.log('[SMS:OTP]', {
    to: toE164,
    code,
    memberId,
    cid,
    ts: new Date().toISOString()
  });

  return { ok: true, provider: 'console' };
};

const sendBroadcastSms = async ({ toE164, body, notificationId, memberId }) => {
  if (config.providers.sms.provider === 'twilio') {
    const client = getTwilioClient();
    await client.messages.create({
      to: toE164,
      from: config.providers.sms.twilioFromNumber,
      body
    });
    return { ok: true, provider: 'twilio' };
  }

  console.log('[SMS:BCAST]', {
    to: toE164,
    notificationId,
    memberId,
    ts: new Date().toISOString()
  });

  return { ok: true, provider: 'console' };
};

module.exports = {
  sendBroadcastSms,
  sendOtpSms
};
