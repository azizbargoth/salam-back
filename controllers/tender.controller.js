const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const db = require('../config/db');
const Tender = require('../model/Tender.model');
const Media = require('../model/Media.model');
const crudController = require('./crud.factory');
const { toMediaData, deleteFile } = require('../services/media.service');
const { getLogger } = require('../services/logger.service');

const logger = getLogger('tenders');

const crud = crudController(Tender, {
  name: 'Tender',
  logger,
  prepare: (data, req, { isUpdate }) => {
    const out = { ...data };
    if (!isUpdate) out.created_by = req.user.id;
    if (out.status === 'open' && !out.published_at) out.published_at = new Date();
    return out;
  },
  // public detail also returns documents and published awards
  decorate: async (item) => {
    item.documents = await Tender.documents(item.id);
    item.awards = await Tender.awards(item.id, { publicOnly: true });
    return item;
  },
});

/** POST /tenders/:id/documents (multipart: file + title/doc_type/lang_code) */
const addDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('A file is required (field "file")', 400);
  const tenderId = req.validated.params.id;
  const { lang_code, ...rest } = req.validated.body;

  const doc = await db.tx(async (c) => {
    const exists = await c.query('SELECT 1 FROM tenders WHERE id = $1', [tenderId]);
    if (!exists.rowCount) throw new AppError('Tender not found', 404);
    const media = await Media.create(toMediaData(req.file, req.user.id), c);
    return Tender.addDocument(c, tenderId, media.id, { ...rest, lang_code: lang_code || null });
  });
  logger.info(`Document ${doc.id} added to tender ${tenderId} by ${req.user.email}`);
  res.status(201).json({ success: true, data: doc });
});

const removeDocument = asyncHandler(async (req, res) => {
  const key = await Tender.removeDocument(req.validated.params.docId);
  if (key === null) throw new AppError('Document not found', 404);
  await deleteFile(key);
  res.json({ success: true, message: 'Document deleted' });
});

const listAwards = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Tender.awards(req.validated.params.id, { publicOnly: true }) });
});

const addAward = asyncHandler(async (req, res) => {
  const tender = await Tender.findById(req.validated.params.id, { publicOnly: false });
  if (!tender) throw new AppError('Tender not found', 404);
  const award = await Tender.addAward(tender.id, req.validated.body);
  logger.info(`Award added to tender ${tender.id} by ${req.user.email}`);
  res.status(201).json({ success: true, data: award });
});

const removeAward = asyncHandler(async (req, res) => {
  if (!(await Tender.removeAward(req.validated.params.awardId))) throw new AppError('Award not found', 404);
  res.json({ success: true, message: 'Award deleted' });
});

module.exports = { ...crud, addDocument, removeDocument, listAwards, addAward, removeAward };
