const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const Media = require('../model/Media.model');
const { toMediaData, deleteFile } = require('../services/media.service');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('media');

/** POST /media  (multipart field "file" + optional alt_text / caption / lang_code) */
const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('A file is required (field "file")', 400);
  const { lang_code, alt_text, caption } = req.validated.body;

  const media = await db.tx(async (c) => {
    const row = await Media.create(toMediaData(req.file, req.user.id), c);
    if (alt_text || caption) await Media.setAlt(c, row.id, lang_code, alt_text || null, caption || null);
    return row;
  });
  logger.info(`Media ${media.id} uploaded by ${req.user.email}`);
  res.status(201).json({ success: true, data: media });
});

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await Media.list(req.validated.query)) });
});

const remove = asyncHandler(async (req, res) => {
  const row = await Media.remove(req.validated.params.id);
  if (!row) throw new AppError('Media not found', 404);
  await deleteFile(row.storage_key);
  logger.info(`Media ${row.id} deleted by ${req.user.email}`);
  res.json({ success: true, message: 'Media deleted' });
});

module.exports = { upload, list, remove };
