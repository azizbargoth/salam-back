const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const User = require('../model/User.model');
const Media = require('../model/Media.model');
const { toMediaData, deleteFile } = require('../services/media.service');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('user');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await User.list(req.validated.query)) });
});

const getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

const create = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.validated.body;
  const user = await User.create({ ...rest, password_hash: await bcrypt.hash(password, 12) });
  logger.info(`User ${user.email} (${user.role_code}) created by ${req.user.email}`);
  res.status(201).json({ success: true, data: user });
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { password, ...rest } = req.validated.body;
  if (id === req.user.id && (rest.status || rest.role_code)) {
    throw new AppError('You cannot change your own role or status', 400);
  }
  const data = { ...rest };
  if (password) data.password_hash = await bcrypt.hash(password, 12);
  const user = await User.update(id, data);
  if (!user) throw new AppError('User not found', 404);
  logger.info(`User ${user.email} updated by ${req.user.email}`);
  res.json({ success: true, data: user });
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  if (id === req.user.id) throw new AppError('You cannot delete your own account', 400);
  if (!(await User.remove(id))) throw new AppError('User not found', 404);
  logger.info(`User ${id} deleted by ${req.user.email}`);
  res.json({ success: true, message: 'User deleted' });
});

const roles = asyncHandler(async (req, res) => res.json({ success: true, data: await User.listRoles() }));

/** PATCH /users/me/avatar  (multipart field "avatar") */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Avatar image is required (field "avatar")', 400);
  const oldMediaId = req.user.avatar_media_id;

  const user = await db.tx(async (c) => {
    const media = await Media.create(toMediaData(req.file, req.user.id), c);
    await c.query('UPDATE users SET avatar_media_id = $1 WHERE id = $2', [media.id, req.user.id]);
    return media;
  });

  if (oldMediaId) {
    const old = await Media.remove(oldMediaId);
    if (old) await deleteFile(old.storage_key);
  }
  logger.info(`Avatar updated: ${req.user.email}`);
  res.json({ success: true, data: { avatar_media_id: user.id, avatar_url: user.url } });
});

module.exports = { list, getOne, create, update, remove, roles, uploadAvatar };
