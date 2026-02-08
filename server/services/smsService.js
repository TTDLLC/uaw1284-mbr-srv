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

module.exports = {
  sendOtpSms
};
