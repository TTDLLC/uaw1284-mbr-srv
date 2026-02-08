const crypto = require('crypto');

const MAX_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 10;

const generateOtp = () => {
  const value = crypto.randomInt(0, 1000000);
  return value.toString().padStart(6, '0');
};

const hashOtp = (code, pepper) => {
  const hmac = crypto.createHmac('sha256', pepper);
  hmac.update(String(code));
  return hmac.digest('hex');
};

const timingSafeEqual = (a, b) => {
  const bufA = Buffer.from(a || '', 'hex');
  const bufB = Buffer.from(b || '', 'hex');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

const getExpiryDate = (minutes = OTP_TTL_MINUTES) =>
  new Date(Date.now() + minutes * 60 * 1000);

module.exports = {
  generateOtp,
  hashOtp,
  timingSafeEqual,
  getExpiryDate,
  MAX_ATTEMPTS,
  OTP_TTL_MINUTES
};
