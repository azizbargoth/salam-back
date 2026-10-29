const env = require('./config/env');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const db = require('./config/db');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { getLogger } = require('./services/logger.service');

const logger = getLogger('app');
const app = express();

function formatError(err) {
  if (err instanceof AggregateError) return err.errors.map(formatError).join('; ');
  if (err instanceof Error) {
    const code = 'code' in err ? err.code : '';
    return [code, err.message].filter(Boolean).join(': ') || err.name;
  }
  return String(err);
}

app.set('trust proxy', 1); // behind nginx / a load balancer
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // allow the front-end to load /uploads images
app.use(cors({ origin: env.corsOrigins.includes('*') ? true : env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// request log
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
  next();
});

// public files only (CVs live in PRIVATE_UPLOAD_DIR and are never served here)
app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', index: false }));

app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

async function start() {
  await db.connect();
  const server = app.listen(env.PORT, () => logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await db.pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  start().catch((err) => {
    logger.error(`Failed to start: ${formatError(err)}`);
    process.exit(1);
  });
}

module.exports = app;
