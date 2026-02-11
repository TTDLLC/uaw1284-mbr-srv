const sendOtpSms = async ({ toE164, code, memberId, cid }) => {
  console.log('[SMS:OTP]', {
    to: toE164,
    code,
    memberId,
    cid,
    ts: new Date().toISOString()
  });

  return { ok: true };
};

const sendBroadcastSms = async ({ toE164, body, notificationId, memberId }) => {
  console.log('[SMS:BCAST]', {
    to: toE164,
    notificationId,
    memberId,
    ts: new Date().toISOString()
  });

  return { ok: true };
};

module.exports = {
  sendBroadcastSms,
  sendOtpSms
};
