const path = require('path');

const pkg = require('../../package.json');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const REDIS_URL = process.env.REDIS_URL || null;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uaw1284-membership';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

if (isProduction && SESSION_SECRET === 'change-me') {
  throw new Error('SESSION_SECRET must be set in production.');
}

if (isProduction && !REDIS_URL) {
  throw new Error('REDIS_URL must be provided in production to enable Redis-backed sessions.');
}

if (!MONGO_URI) {
  throw new Error('MONGO_URI must be configured to connect to MongoDB.');
}

const APP_VERSION = pkg.version;
const APP_NAME = pkg.name;

const config = {
  APP_NAME,
  APP_VERSION,
  LOG_LEVEL,
  MONGO_URI,
  NODE_ENV,
  PORT,
  REDIS_URL,
  SESSION_SECRET,
  isProduction,
  projectRoot: path.resolve(__dirname, '..', '..')
};

module.exports = config;
