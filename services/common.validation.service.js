const Joi = require('joi');

const LANGS = ['ar', 'en','ku']; // keep in sync with the `languages` table

const langCode = Joi.string().valid(...LANGS);
const slug = Joi.string()
  .max(300)
  .pattern(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u)
  .messages({ 'string.pattern.base': 'slug must be letters/numbers separated by single hyphens' });

const id = Joi.number().integer().positive();
const uuid = Joi.string().uuid();
const text = Joi.string().trim().allow('', null);
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'must be YYYY-MM-DD' });
const timestamp = Joi.date().iso();

const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  lang: langCode,
  search: Joi.string().trim().max(100),
  sort: Joi.string().max(40),
});

const langQuery = Joi.object({ lang: langCode });

const idParams = (type = 'int', key = 'id') =>
  Joi.object({ [key]: (type === 'uuid' ? uuid : id).required() });

const keyParams = Joi.object({ key: Joi.string().trim().max(300).required() });

/**
 * Builds create/update schemas for "base + translations" entities.
 *  base / baseRequired : language-neutral fields
 *  tr   / trRequired   : per-language fields
 */
function makeSchemas({ base, baseRequired = [], tr, trRequired = [] }) {
  const trCreate = Joi.object({ lang_code: langCode.required(), ...tr }).fork(trRequired, (s) => s.required());
  const trUpdate = Joi.object({ lang_code: langCode.required(), ...tr });

  const create = Joi.object({
    ...base,
    translations: Joi.array().items(trCreate).min(1).unique('lang_code').required(),
  }).fork(baseRequired, (s) => s.required());

  const update = Joi.object({
    ...base,
    translations: Joi.array().items(trUpdate).min(1).unique('lang_code'),
  }).min(1);

  return { create, update };
}

module.exports = { Joi, LANGS, langCode, slug, id, uuid, text, dateOnly, timestamp, listQuery, langQuery, idParams, keyParams, makeSchemas };
