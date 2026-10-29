/**
 * Generic CRUD controller for "base + translations" models.
 * Entity controllers (post, job, tender ...) wrap this and add their own endpoints.
 *
 *  prepare(data, req, { isUpdate })  -> adjust body before saving (set author, dates ...)
 *  decorate(item, req)               -> enrich a public single item (documents, views ...)
 */
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const env = require('../config/env');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = function crudController(Model, { name, logger, idType = 'int', prepare, decorate }) {
  const isId = (key) => (idType === 'uuid' ? UUID_RE.test(key) : /^\d+$/.test(key));
  const notFound = () => new AppError(`${name} not found`, 404);
  const who = (req) => req.user?.email || 'system';

  const listHandler = (publicOnly) =>
    asyncHandler(async (req, res) => {
      const { page, limit, lang, search, sort, ...filters } = req.validated.query;
      const result = await Model.list({ lang: lang || env.DEFAULT_LANG, page, limit, search, sort, filters, publicOnly });
      res.json({ success: true, ...result });
    });

  /** Public: GET /:key  (key = id or slug) */
  const getOne = asyncHandler(async (req, res) => {
    const { key } = req.validated.params;
    const lang = req.validated.query?.lang || env.DEFAULT_LANG;
    const opts = { lang, publicOnly: true };
    let item = isId(key) ? await Model.findById(key, opts) : await Model.findBySlug(key, opts);
    if (!item) throw notFound();
    item.alternates = await Model.alternates(item.id);
    if (decorate) item = await decorate(item, req);
    res.json({ success: true, data: item });
  });

  /** Admin: GET /admin/:id (includes drafts + all translations) */
  const adminGet = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const lang = req.validated.query?.lang || env.DEFAULT_LANG;
    const item = await Model.findById(id, { lang, publicOnly: false });
    if (!item) throw notFound();
    item.translations = await Model.translations(id);
    res.json({ success: true, data: item });
  });

  const create = asyncHandler(async (req, res) => {
    const data = prepare ? await prepare(req.validated.body, req, { isUpdate: false }) : req.validated.body;
    const { translations, ...base } = data;
    const id = await Model.create(base, translations);
    logger.info(`${name} ${id} created by ${who(req)}`);
    const item = await Model.findById(id, { lang: translations[0].lang_code, publicOnly: false });
    item.translations = await Model.translations(id);
    res.status(201).json({ success: true, data: item });
  });

  const update = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const data = prepare ? await prepare(req.validated.body, req, { isUpdate: true }) : req.validated.body;
    const { translations, ...base } = data;
    const ok = await Model.update(id, base, translations);
    if (!ok) throw notFound();
    logger.info(`${name} ${id} updated by ${who(req)}`);
    const item = await Model.findById(id, { publicOnly: false });
    item.translations = await Model.translations(id);
    res.json({ success: true, data: item });
  });

  const remove = asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const ok = await Model.remove(id);
    if (!ok) throw notFound();
    logger.info(`${name} ${id} deleted by ${who(req)}`);
    res.json({ success: true, message: `${name} deleted` });
  });

  return { list: listHandler(true), adminList: listHandler(false), getOne, adminGet, create, update, remove };
};
