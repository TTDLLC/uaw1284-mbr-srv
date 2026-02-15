require('dotenv').config();

const normalizeAppUrl = (value) => {
  if (!value) {
    return null;
  }
  return String(value).trim().replace(/\/+$/, '');
};

const raw = process.env;
const NODE_ENV = raw.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isDev = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

const MONGODB_URI = raw.MONGODB_URI || raw.MONGO_URI || '';
const APP_URL = normalizeAppUrl(raw.APP_URL);

const EMAIL_PROVIDER = raw.EMAIL_PROVIDER || (isProd ? '' : 'console');
const EMAIL_FROM = raw.EMAIL_FROM || '';
const POSTMARK_TOKEN = raw.POSTMARK_TOKEN || '';

const SMS_PROVIDER = raw.SMS_PROVIDER || (isProd ? '' : 'console');
const TWILIO_ACCOUNT_SID = raw.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = raw.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = raw.TWILIO_FROM_NUMBER || '';

const CSRF_SECRET = raw.CSRF_SECRET || '';

const missing = [];

if (!MONGODB_URI) {
  missing.push('MONGODB_URI');
}
if (!raw.SESSION_SECRET) {
  missing.push('SESSION_SECRET');
}
if (!APP_URL) {
  missing.push('APP_URL');
}

if (isProd && APP_URL && !APP_URL.startsWith('https://')) {
  throw new Error('APP_URL must be an https URL in production.');
}

if (isProd && raw.SESSION_SECRET === 'change-me') {
  throw new Error('SESSION_SECRET must not use the default placeholder value in production.');
}

if (isProd && missing.length) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
}

const ensureEmailProviderConfig = () => {
  if (!EMAIL_PROVIDER) {
    if (isProd) {
      throw new Error('EMAIL_PROVIDER must be configured in production.');
    }
    console.warn('EMAIL_PROVIDER not set; email will use console stub.');
    return;
  }
  if (EMAIL_PROVIDER === 'postmark') {
    if (!EMAIL_FROM || !POSTMARK_TOKEN) {
      throw new Error('EMAIL_FROM and POSTMARK_TOKEN are required for Postmark.');
    }
    return;
  }
  if (EMAIL_PROVIDER === 'console') {
    if (isProd) {
      throw new Error('EMAIL_PROVIDER=console is not allowed in production.');
    }
    return;
  }
  throw new Error(`Unsupported EMAIL_PROVIDER "${EMAIL_PROVIDER}".`);
};

const ensureSmsProviderConfig = () => {
  if (!SMS_PROVIDER) {
    if (isProd) {
      throw new Error('SMS_PROVIDER must be configured in production.');
    }
    console.warn('SMS_PROVIDER not set; SMS will use console stub.');
    return;
  }
  if (SMS_PROVIDER === 'twilio') {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER are required for Twilio.');
    }
    return;
  }
  if (SMS_PROVIDER === 'console') {
    if (isProd) {
      throw new Error('SMS_PROVIDER=console is not allowed in production.');
    }
    return;
  }
  throw new Error(`Unsupported SMS_PROVIDER "${SMS_PROVIDER}".`);
};

if (isProd) {
  ensureEmailProviderConfig();
  ensureSmsProviderConfig();
} else {
  if (EMAIL_PROVIDER && EMAIL_PROVIDER !== 'console') {
    ensureEmailProviderConfig();
  }
  if (SMS_PROVIDER && SMS_PROVIDER !== 'console') {
    ensureSmsProviderConfig();
  }
}

module.exports = {
  raw,
  NODE_ENV,
  isProd,
  isDev,
  isTest,
  MONGODB_URI,
  APP_URL,
  SESSION_SECRET: raw.SESSION_SECRET || '',
  EMAIL_PROVIDER,
  EMAIL_FROM,
  POSTMARK_TOKEN,
  SMS_PROVIDER,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  CSRF_SECRET
};
