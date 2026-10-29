const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const User = require('../model/User.model');
const tokenService = require('../services/token.service');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('auth');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps timing similar for unknown emails

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findByEmail(email);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    logger.warn(`Failed login for ${email} from ${req.ip}`);
    throw new AppError('Invalid email or password', 401);
  }
  if (user.status !== 'active') throw new AppError('This account is not active', 403);

  await User.touchLogin(user.id);
  const { password_hash, ...safeUser } = user;
  logger.info(`Login: ${email} (${user.role_code}) from ${req.ip}`);
  res.json({ success: true, data: { token: tokenService.sign(user), user: safeUser } });
});

const me = (req, res) => res.json({ success: true, data: req.user });

const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.validated.body;
  const user = await User.findByEmail(req.user.email);
  if (!(await bcrypt.compare(current_password, user.password_hash))) {
    throw new AppError('Current password is incorrect', 400);
  }
  await User.update(user.id, { password_hash: await bcrypt.hash(new_password, 12) });
  logger.info(`Password changed: ${user.email}`);
  res.json({ success: true, message: 'Password updated' });
});

// Tokens are stateless; the client just discards its token. We log it for the audit trail.
const logout = (req, res) => {
  logger.info(`Logout: ${req.user.email}`);
  res.json({ success: true, message: 'Logged out' });
};

module.exports = { login, me, changePassword, logout };
