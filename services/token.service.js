const jwt = require('jsonwebtoken');
const env = require('../config/env');

const sign = (user) =>
  jwt.sign({ sub: user.id, role: user.role_code }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const verify = (token) => jwt.verify(token, env.JWT_SECRET);

module.exports = { sign, verify };
