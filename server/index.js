const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const session = require('express-session');
const pinoHttp = require('pino-http');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const config = require('./config');
require('./models');
const { requestId, notFound, errorHandler } = require('./middleware');
const limiters = require('./middleware/limiters');
const { assertSessionCookieSecurity } = require('./middleware/session');
const { protectRoutes: csrfProtection, attachCsrfTokenToLocals } = require('./middleware/csrf');
const baseLogger = require('./logger');
const { initSentry } = require('./monitoring/sentry');
const { metricsMiddleware, metricsHandler } = require('./metrics');
const { attachCurrentUser } = require('./middleware/auth');

async function start() {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy !== false) {
    app.set('trust proxy', config.trustProxy);
  }

  const logger = baseLogger.child({ component: 'server' });
  const httpLogger = baseLogger.child({ component: 'http' });
  app.locals.logger = baseLogger;
  app.locals.startedAt = new Date();
  app.locals.mongoStatus = 'connecting';

  const sentryHandlers = initSentry();
  if (sentryHandlers?.requestHandler) {
    app.use(sentryHandlers.requestHandler);
    if (sentryHandlers.tracingHandler) {
      app.use(sentryHandlers.tracingHandler);
    }
  }

  try {
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    app.locals.mongoStatus = 'ready';
    mongoose.connection.on('disconnected', () => {
      app.locals.mongoStatus = 'disconnected';
      logger.warn('MongoDB connection lost');
    });
    mongoose.connection.on('error', (err) => {
      app.locals.mongoStatus = 'error';
      logger.error({ err }, 'MongoDB connection error');
    });
  } catch (err) {
    app.locals.mongoStatus = 'error';
    logger.error({ err }, 'Failed to connect to MongoDB');
    throw err;
  }

  app.use(requestId);
  app.use(metricsMiddleware);
  app.use(pinoHttp({
    logger: httpLogger,
    genReqId: (req) => req.id,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.originalUrl || req.url,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode
        };
      }
    },
    customProps: (req, res) => ({
      requestId: req.id,
      userId: req.session?.user?.id || null,
      route: req.route?.path || null
    }),
    customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl || req.url} completed with ${res.statusCode}`,
    customErrorMessage: (req, res, err) => err?.message || `${req.method} ${req.originalUrl || req.url} errored`,
    customLogLevel: (res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    }
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  app.use(limiters.general);

  const serializeSession = (sessionData) => {
    const plainObject = {};
    Object.keys(sessionData).forEach((key) => {
      if (key === 'cookie') {
        const cookieValue = sessionData.cookie;
        plainObject.cookie = typeof cookieValue?.toJSON === 'function' ? cookieValue.toJSON() : cookieValue;
      } else if (typeof sessionData[key] !== 'function') {
        plainObject[key] = sessionData[key];
      }
    });
    return plainObject;
  };

  const deserializeSession = (storedValue) => {
    if (storedValue == null) {
      return undefined;
    }
    if (typeof storedValue === 'string') {
      try {
        return JSON.parse(storedValue);
      } catch (err) {
        logger.warn({ err }, 'Unable to parse stored session JSON, dropping value');
        return undefined;
      }
    }
    return storedValue;
  };

  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
    ttl: config.TTL.sessionSeconds,
    autoRemove: 'native',
    stringify: false,
    serialize: serializeSession,
    unserialize: deserializeSession
  });

  const sessionOptions = {
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'uaw1284.sid',
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: config.TTL.sessionMs
    }
  };

  assertSessionCookieSecurity(sessionOptions.cookie, { isProd: config.isProd });
  app.use(session(sessionOptions));
  app.use(attachCurrentUser);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(csrfProtection);
  app.use(attachCsrfTokenToLocals);

  app.set('view engine', 'ejs');
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set('views', path.join(__dirname, '../client/views'));

  app.use(express.static(path.join(__dirname, '../client/public')));

  app.use('/', require('./routes/index'));
  app.use('/api/health', require('./routes/api/health'));
  app.get('/api/metrics', metricsHandler);
  app.use('/api/auth', require('./routes/api/auth'));
  app.use('/api/admin', require('./routes/api/admin'));
  app.use('/api/members', require('./routes/api/members'));

  app.use(notFound);
  if (sentryHandlers?.errorHandler) {
    app.use(sentryHandlers.errorHandler);
  }
  app.use(errorHandler);

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'UAW Local 1284 membership server listening');
    if (!config.isProd) {
      logger.debug('Running in DEVELOPMENT mode');
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
