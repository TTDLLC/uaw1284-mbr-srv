require('dotenv').config();

const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const csrf = require('csurf');
const pino = require('pino');
const pinoHttp = require('pino-http');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const config = require('./config');
const { requestId, notFound, errorHandler } = require('./middleware');

async function start() {
  const app = express();

  app.disable('x-powered-by');
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  const logger = pino({ level: config.LOG_LEVEL });
  app.locals.logger = logger;
  app.locals.startedAt = new Date();
  app.locals.mongoStatus = 'connecting';

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
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customProps: (req) => ({ requestId: req.id })
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
        upgradeInsecureRequests: config.isProduction ? [] : null,
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.isProduction ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(generalLimiter);

  const sessionStore = MongoStore.create({
    mongoUrl: config.MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    autoRemove: 'native'
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
      secure: config.isProduction,
      maxAge: 24 * 60 * 60 * 1000
    }
  };

  app.use(session(sessionOptions));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const csrfProtection = csrf();
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return csrfProtection(req, res, next);
  });

  app.use((req, res, next) => {
    if (typeof req.csrfToken === 'function') {
      res.locals.csrfToken = req.csrfToken();
    }
    res.locals.requestId = req.id;
    next();
  });

  app.set('view engine', 'ejs');
  app.use(expressLayouts);
  app.set('layout', 'layout');
  app.set('views', path.join(__dirname, '../client/views'));

  app.use(express.static(path.join(__dirname, '../client/public')));

  app.use('/', require('./routes/index'));
  app.use('/api/health', require('./routes/api/health'));

  app.use(notFound);
  app.use(errorHandler);

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'UAW Local 1284 membership server listening');
    if (!config.isProduction) {
      logger.debug('Running in DEVELOPMENT mode');
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
