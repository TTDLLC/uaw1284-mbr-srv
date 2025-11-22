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
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

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
  app.locals.redisStatus = config.isProduction ? 'connecting' : 'not-required';

  let redisClient = null;
  if (config.isProduction) {
    redisClient = createClient({ url: config.REDIS_URL });
    redisClient.on('error', (err) => logger.error({ err }, 'Redis client error'));
    try {
      await redisClient.connect();
      app.locals.redisStatus = 'ready';
    } catch (err) {
      app.locals.redisStatus = 'error';
      logger.error({ err }, 'Failed to connect to Redis');
      throw err;
    }
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

  const sessionOptions = {
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'uaw1284.sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: 24 * 60 * 60 * 1000
    }
  };

  if (config.isProduction && redisClient) {
    sessionOptions.store = new RedisStore({
      client: redisClient,
      prefix: `${config.APP_NAME}:sess:`
    });
  }

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
