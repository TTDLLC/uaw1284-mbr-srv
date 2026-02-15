const path = require('path');

const pkg = require('../../package.json');
const env = require('./env');

const parseNumberFromEnv = (value, defaultValue, { min, max } = {}) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  if (typeof min === 'number' && parsed < min) {
    return min;
  }
  if (typeof max === 'number' && parsed > max) {
    return max;
  }
  return parsed;
};

const parseBoolFromEnv = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const NODE_ENV = env.NODE_ENV;
const isProd = env.isProd;
const isDev = env.isDev;
const isTest = env.isTest;

const defaultMongoUri = 'mongodb://127.0.0.1:27017/uaw1284-membership';
const MONGO_URI = env.MONGODB_URI || defaultMongoUri;

const defaultSessionSecret = 'change-me';
const SESSION_SECRET = env.SESSION_SECRET || defaultSessionSecret;

const PORT = Number(env.raw.PORT) || 3000;
const LOG_LEVEL = env.raw.LOG_LEVEL || (isProd ? 'info' : 'debug');

const normalizeAppUrl = (value) => {
  if (!value) {
    return null;
  }
  return String(value).trim().replace(/\/+$/, '');
};

const APP_URL = normalizeAppUrl(env.APP_URL);
if (!APP_URL) {
  const message = 'APP_URL must be configured to generate magic links.';
  if (isProd) {
    throw new Error(message);
  }
  console.error(message);
}

const DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60;
const rawSessionTtl = env.raw.SESSION_TTL_SECONDS;
const parsedSessionTtl = rawSessionTtl == null || rawSessionTtl.length === 0
  ? DEFAULT_SESSION_TTL_SECONDS
  : Number.parseInt(rawSessionTtl, 10);
if (!Number.isFinite(parsedSessionTtl) || parsedSessionTtl <= 0) {
  throw new Error('SESSION_TTL_SECONDS must be a positive integer.');
}
const SESSION_TTL_SECONDS = parsedSessionTtl;
const TTL = Object.freeze({
  sessionSeconds: SESSION_TTL_SECONDS,
  sessionMs: SESSION_TTL_SECONDS * 1000
});

const parseTrustProxy = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return isProd ? 1 : false;
  }
  const lower = String(rawValue).toLowerCase();
  if (lower === 'false' || lower === '0') {
    return false;
  }
  if (lower === 'true') {
    return true;
  }
  const numeric = Number(rawValue);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  return rawValue;
};

const trustProxy = parseTrustProxy(env.raw.TRUST_PROXY);

const passwordPolicy = Object.freeze({
  minLength: parseNumberFromEnv(env.raw.PASSWORD_MIN_LENGTH, 12, { min: 8, max: 256 }),
  maxLength: parseNumberFromEnv(env.raw.PASSWORD_MAX_LENGTH, 128, { min: 32, max: 512 }),
  requireLowercase: parseBoolFromEnv(env.raw.PASSWORD_REQUIRE_LOWERCASE, true),
  requireUppercase: parseBoolFromEnv(env.raw.PASSWORD_REQUIRE_UPPERCASE, true),
  requireDigits: parseBoolFromEnv(env.raw.PASSWORD_REQUIRE_DIGITS, true),
  requireSymbols: parseBoolFromEnv(env.raw.PASSWORD_REQUIRE_SYMBOLS, true)
});

if (passwordPolicy.minLength > passwordPolicy.maxLength) {
  throw new Error('PASSWORD_MIN_LENGTH must be less than PASSWORD_MAX_LENGTH');
}

const bcryptCost = parseNumberFromEnv(env.raw.BCRYPT_COST, isProd ? 12 : 10, { min: 6, max: 15 });

const rateLimitDefaults = {
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 1000
};

const generalRateLimit = Object.freeze({
  windowMs: parseNumberFromEnv(env.raw.RATE_LIMIT_WINDOW_MS, rateLimitDefaults.windowMs, { min: 60 * 1000 }),
  max: parseNumberFromEnv(env.raw.RATE_LIMIT_MAX, rateLimitDefaults.max, { min: 10 })
});

const loginRateLimit = Object.freeze({
  windowMs: parseNumberFromEnv(env.raw.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, { min: 60 * 1000 }),
  max: parseNumberFromEnv(env.raw.LOGIN_RATE_LIMIT_MAX, isProd ? 5 : 25, { min: 3 })
});

const passwordResetRateLimit = Object.freeze({
  windowMs: parseNumberFromEnv(env.raw.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000, { min: 5 * 60 * 1000 }),
  max: parseNumberFromEnv(env.raw.PASSWORD_RESET_RATE_LIMIT_MAX, isProd ? 3 : 10, { min: 1 })
});

const passwordResetTokenTtlMinutes = parseNumberFromEnv(
  env.raw.PASSWORD_RESET_TOKEN_TTL_MINUTES,
  30,
  { min: 1 }
);

const adminActionRateLimit = Object.freeze({
  windowMs: parseNumberFromEnv(env.raw.ADMIN_ACTION_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, { min: 60 * 1000 }),
  max: parseNumberFromEnv(env.raw.ADMIN_ACTION_RATE_LIMIT_MAX, isProd ? 20 : 100, { min: 5 })
});

const limits = Object.freeze({
  jsonBody: env.raw.JSON_BODY_LIMIT || '1mb',
  urlencodedBody: env.raw.URLENCODED_BODY_LIMIT || '1mb'
});

const normalizeLogDestination = (value) => {
  const normalized = String(value || 'stdout').toLowerCase();
  if (['stdout', 'file'].includes(normalized)) {
    return normalized;
  }
  return 'stdout';
};

const defaultLogRedactions = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  'req.body.token',
  'req.body.sessionToken'
];

const logging = Object.freeze({
  destination: normalizeLogDestination(env.raw.LOG_DESTINATION),
  redactPaths: defaultLogRedactions,
  file: Object.freeze({
    directory: env.raw.LOG_FILE_DIR || path.resolve(__dirname, '..', '..', 'logs'),
    name: env.raw.LOG_FILE_NAME || 'app.log',
    rotationInterval: env.raw.LOG_FILE_ROTATION || '1d',
    maxFiles: parseNumberFromEnv(env.raw.LOG_FILE_MAX_FILES, 14, { min: 1, max: 90 })
  })
});

const sentryTracesSampleRateRaw = Number(env.raw.SENTRY_TRACES_SAMPLE_RATE);
const sentryTracesSampleRate = Number.isFinite(sentryTracesSampleRateRaw)
  ? Math.min(Math.max(sentryTracesSampleRateRaw, 0), 1)
  : 0;

const monitoring = Object.freeze({
  metrics: Object.freeze({
    enabled: parseBoolFromEnv(env.raw.METRICS_ENABLED, true)
  }),
  sentry: Object.freeze({
    dsn: env.raw.SENTRY_DSN || '',
    environment: env.raw.SENTRY_ENV || NODE_ENV,
    tracesSampleRate: sentryTracesSampleRate,
    enabled: Boolean(env.raw.SENTRY_DSN && env.raw.SENTRY_DSN.length > 0)
  })
});

const APP_VERSION = pkg.version;
const APP_NAME = pkg.name;

const config = {
  APP_NAME,
  APP_VERSION,
  APP_URL,
  LOG_LEVEL,
  MONGO_URI,
  NODE_ENV,
  PORT,
  SESSION_SECRET,
  TTL,
  limits,
  isDev,
  isProd,
  isProduction: isProd,
  isTest,
  projectRoot: path.resolve(__dirname, '..', '..'),
  trustProxy,
  logging,
  monitoring,
  providers: Object.freeze({
    email: Object.freeze({
      provider: env.EMAIL_PROVIDER,
      from: env.EMAIL_FROM,
      postmarkToken: env.POSTMARK_TOKEN
    }),
    sms: Object.freeze({
      provider: env.SMS_PROVIDER,
      twilioAccountSid: env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: env.TWILIO_AUTH_TOKEN,
      twilioFromNumber: env.TWILIO_FROM_NUMBER
    })
  }),
  security: Object.freeze({
    bcryptCost,
    passwordPolicy,
    passwordResetTokenTtlMinutes,
    rateLimits: Object.freeze({
      adminAction: adminActionRateLimit,
      general: generalRateLimit,
      login: loginRateLimit,
      passwordReset: passwordResetRateLimit
    })
  })
};

module.exports = config;
