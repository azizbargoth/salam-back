const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const PRIVATE_PREFIX = 'private/';

const kindOf = (mime = '') => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || mime.includes('word') || mime.includes('sheet') || mime.includes('excel')) {
    return 'document';
  }
  return 'other';
};

/** Convert a multer file into a row for the `media` table. */
function toMediaData(file, userId = null, { isPrivate = false } = {}) {
  const base = isPrivate ? env.privateDir : env.uploadDir;
  const rel = path.relative(base, file.path).split(path.sep).join('/');
  return {
    kind: kindOf(file.mimetype),
    storage_key: isPrivate ? PRIVATE_PREFIX + rel : rel,
    url: isPrivate ? '' : `/uploads/${rel}`,
    mime_type: file.mimetype,
    size_bytes: file.size,
    uploaded_by: userId,
  };
}

function resolveStoragePath(key) {
  return key.startsWith(PRIVATE_PREFIX)
    ? path.join(env.privateDir, key.slice(PRIVATE_PREFIX.length))
    : path.join(env.uploadDir, key);
}

const deleteFile = (key) => (key ? fs.promises.unlink(resolveStoragePath(key)).catch(() => {}) : Promise.resolve());

module.exports = { toMediaData, resolveStoragePath, deleteFile, PRIVATE_PREFIX };
