const path = require('path');
const fs = require('fs');
const winston = require('winston');
const env = require('../config/env');

const dir = path.join(__dirname, '..', 'logs');
fs.mkdirSync(dir, { recursive: true });

const MB = 1024 * 1024;
const cache = {};

/**
 * getLogger('auth') -> writes to logs/auth.log AND logs/all.log
 * (same idea as your all.log / auth.log / blogs.log files).
 */
function getLogger(name = 'app') {
  if (cache[name]) return cache[name];

  const transports = [
    new winston.transports.File({ filename: path.join(dir, 'all.log'), maxsize: 5 * MB, maxFiles: 5 }),
    new winston.transports.File({ filename: path.join(dir, `${name}.log`), maxsize: 5 * MB, maxFiles: 3 }),
  ];
  if (!env.isProd) transports.push(new winston.transports.Console());

  cache[name] = winston.createLogger({
    level: env.isProd ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.label({ label: name }),
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message, label }) => `${timestamp} [${label}] ${level.toUpperCase()}: ${message}`
      )
    ),
    transports,
  });
  return cache[name];
}

module.exports = { getLogger };
