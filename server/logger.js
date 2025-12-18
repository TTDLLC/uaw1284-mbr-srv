const fs = require('fs');
const pino = require('pino');
const rfs = require('rotating-file-stream');

const config = require('./config');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createFileStream() {
  const { directory, name, rotationInterval, maxFiles } = config.logging.file;
  ensureDirectory(directory);
  return rfs.createStream(name, {
    interval: rotationInterval,
    path: directory,
    maxFiles
  });
}

function createDestination() {
  if (config.logging.destination === 'file') {
    return createFileStream();
  }
  // Use stdout for default shipping to a centralized collector/container logs.
  return pino.destination(1);
}

const logger = pino(
  {
    level: config.LOG_LEVEL,
    redact: {
      paths: config.logging.redactPaths,
      censor: '[REDACTED]'
    },
    base: {
      app: config.APP_NAME,
      env: config.NODE_ENV,
      version: config.APP_VERSION
    },
    formatters: {
      level(label) {
        return { level: label };
      }
    }
  },
  createDestination()
);

module.exports = logger;
