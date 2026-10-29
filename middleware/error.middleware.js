const fs = require('fs');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('app');

const PG_ERRORS = {
  '23505': [409, 'A record with the same unique value (e.g. slug, reference number, email) already exists'],
  '23503': [409, 'A referenced record does not exist, or this record is still in use'],
  '22P02': [400, 'Invalid value format (check ids, dates and enum values)'],
  '23502': [400, 'A required field is missing'],
  '23514': [400, 'A value violates a data rule (check dates / amounts)'],
  '22001': [400, 'A value is too long for its field'],
};

const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // remove an uploaded file when the request failed
  if (req.file?.path) fs.unlink(req.file.path, () => {});

  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err.code && PG_ERRORS[err.code]) {
    [status, message] = PG_ERRORS[err.code];
    if (!env.isProd && err.detail) details = err.detail;
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
    if (env.isProd) message = 'Internal server error';
  }

  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
};

module.exports = { notFound, errorHandler };
