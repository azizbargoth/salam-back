const { Joi, slug, id, uuid, text, dateOnly, listQuery, makeSchemas } = require('./common.validation.service');

const STATUS = ['planned', 'ongoing', 'completed', 'suspended'];
const VISIBILITY = ['draft', 'scheduled', 'published', 'archived'];
const count = Joi.number().integer().min(0).allow(null);

const base = {
  code: Joi.string().trim().max(40).allow(null),
  status: Joi.string().valid(...STATUS),
  start_date: dateOnly.allow(null),
  end_date: dateOnly.allow(null),
  budget_amount: Joi.number().precision(2).min(0).allow(null),
  budget_currency: Joi.string().uppercase().length(3),
  show_budget: Joi.boolean(),
  beneficiaries_total: count,
  beneficiaries_women: count,
  beneficiaries_men: count,
  beneficiaries_girls: count,
  beneficiaries_boys: count,
  cover_media_id: uuid.allow(null),
  is_featured: Joi.boolean(),
  visibility: Joi.string().valid(...VISIBILITY),
  sector_ids: Joi.array().items(id).unique(),
  location_ids: Joi.array().items(id).unique(),
  donor_ids: Joi.array().items(id).unique(),
};

const tr = {
  slug,
  title: Joi.string().trim().max(250),
  summary: text,
  objectives: text,
  description: text,
  results: text,
  meta_title: Joi.string().max(200).allow('', null),
  meta_description: Joi.string().max(320).allow('', null),
};

const { create, update } = makeSchemas({ base, tr, trRequired: ['title'] });

const list = listQuery.keys({
  status: Joi.string().valid(...STATUS),
  visibility: Joi.string().valid(...VISIBILITY),
  is_featured: Joi.boolean(),
});

module.exports = { create, update, list };
