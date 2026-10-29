const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const tokenService = require('../services/token.service');
const User = require('../model/User.model');

/** Requires a valid Bearer token and an active account. Sets req.user. */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(\S+)\s*$/i);
  const token = match ? match[1] : null;
  if (!token) throw new AppError('Authentication required', 401);

  let payload;
  try {
    payload = tokenService.verify(token);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') throw new AppError('Account not found or inactive', 401);
  req.user = user;
  next();
});

/** authorize('editor') -> editors and super_admin. authorize() -> super_admin only. */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (req.user.role_code === 'super_admin' || roles.includes(req.user.role_code)) return next();
    next(new AppError('You do not have permission to perform this action', 403));
  };

module.exports = { authenticate, authorize };
