require('dotenv').config();

const path = require('path');

const pkg = require('../../package.json');
const { REQUIRED_ENV_VARS, validateRequiredEnv } = require('./requiredEnv');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isDev = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

validateRequiredEnv({
  env: process.env,
  required: REQUIRED_ENV_VARS,
  disallowValues: { SESSION_SECRET: 'change-me' },
  enabled: isProd
});

const defaultMongoUri = 'mongodb://127.0.0.1:27017/uaw1284-membership';
const MONGO_URI = process.env.MONGO_URI || defaultMongoUri;

const defaultSessionSecret = 'change-me';
const SESSION_SECRET = process.env.SESSION_SECRET || defaultSessionSecret;
if (isProd && SESSION_SECRET === defaultSessionSecret) {
  throw new Error('SESSION_SECRET must be set in production.');
}

if (!MONGO_URI) {
  throw new Error('MONGO_URI must be configured to connect to MongoDB.');
}

const PORT = Number(process.env.PORT) || 3000;
const LOG_LEVEL = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60;
const rawSessionTtl = process.env.SESSION_TTL_SECONDS;
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

const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);

const APP_VERSION = pkg.version;
const APP_NAME = pkg.name;

const config = {
  APP_NAME,
  APP_VERSION,
  LOG_LEVEL,
  MONGO_URI,
  NODE_ENV,
  PORT,
  SESSION_SECRET,
  TTL,
  isDev,
  isProd,
  isProduction: isProd,
  isTest,
  projectRoot: path.resolve(__dirname, '..', '..'),
  trustProxy
};

module.exports = config;
