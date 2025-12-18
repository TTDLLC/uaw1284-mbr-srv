const Sentry = require('@sentry/node');

const config = require('../config');

let initialized = false;

function initSentry() {
  if (!config.monitoring.sentry.enabled) {
    return null;
  }

  if (!initialized) {
    Sentry.init({
      dsn: config.monitoring.sentry.dsn,
      environment: config.monitoring.sentry.environment,
      release: `${config.APP_NAME}@${config.APP_VERSION}`,
      tracesSampleRate: config.monitoring.sentry.tracesSampleRate
    });
    initialized = true;
  }

  return {
    requestHandler: Sentry.Handlers.requestHandler(),
    tracingHandler: Sentry.Handlers.tracingHandler(),
    errorHandler: Sentry.Handlers.errorHandler()
  };
}

function captureException(err, scopeCallback) {
  if (!config.monitoring.sentry.enabled || !initialized) {
    return;
  }
  Sentry.withScope((scope) => {
    if (typeof scopeCallback === 'function') {
      scopeCallback(scope);
    }
    Sentry.captureException(err);
  });
}

module.exports = {
  captureException,
  initSentry,
  sentryEnabled: () => config.monitoring.sentry.enabled
};
