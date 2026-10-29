const rateLimit = require('express-rate-limit');

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

module.exports = {
  apiLimiter: make(15 * 60 * 1000, 300, 'Too many requests, please try again later'),
  authLimiter: make(15 * 60 * 1000, 10, 'Too many login attempts, please try again in 15 minutes'),
  formLimiter: make(10 * 60 * 1000, 5, 'Too many submissions, please try again later'),
  applyLimiter: make(60 * 60 * 1000, 10, 'Too many applications from this address, please try again later'),
};
