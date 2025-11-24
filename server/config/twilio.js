let client = null;

try {
  // eslint-disable-next-line global-require
  const twilio = require('twilio');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
} catch (err) {
  client = null;
}

module.exports = client;
