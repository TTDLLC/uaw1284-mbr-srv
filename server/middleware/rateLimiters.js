const limiters = require('./limiters');

module.exports = {
  loginLimiter: limiters.login,
  otpSendLimiter: limiters.otpSend,
  otpConfirmLimiter: limiters.otpConfirm
};
