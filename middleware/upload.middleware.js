const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// Extension is derived from the MIME type, never from the client's file name.
const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'video/mp4': '.mp4',
};

const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const SHEETS = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

function makeUploader({ allowed, maxMB, baseDir, subDir = '' }) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const d = new Date();
      const dir = path.join(baseDir, subDir, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT[file.mimetype] || ''}`),
  });
  return multer({
    storage,
    limits: { fileSize: maxMB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) =>
      allowed.includes(file.mimetype) ? cb(null, true) : cb(new AppError(`File type not allowed: ${file.mimetype}`, 415)),
  });
}

module.exports = {
  /** profile picture: field "avatar" */
  avatarUpload: makeUploader({ allowed: IMAGES, maxMB: 2, baseDir: env.uploadDir, subDir: 'avatars' }).single('avatar'),
  /** media library: field "file" (images, PDFs, Word/Excel, mp4) */
  mediaUpload: makeUploader({
    allowed: [...IMAGES, ...DOCS, ...SHEETS, 'video/mp4'],
    maxMB: 25,
    baseDir: env.uploadDir,
  }).single('file'),
  /** tender documents: field "file" */
  documentUpload: makeUploader({ allowed: [...DOCS, ...SHEETS], maxMB: 15, baseDir: env.uploadDir, subDir: 'tenders' }).single('file'),
  /** CVs: field "cv" — stored in the PRIVATE folder (never served statically) */
  cvUpload: makeUploader({ allowed: DOCS, maxMB: 5, baseDir: env.privateDir, subDir: 'cv' }).single('cv'),
};
