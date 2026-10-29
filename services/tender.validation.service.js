const { Joi, slug, id, text, timestamp, dateOnly, langCode, listQuery, makeSchemas } = require('./common.validation.service');

const STATUS = ['draft', 'open', 'closed', 'awarded', 'cancelled'];
const TYPES = ['goods', 'services', 'works', 'consultancy', 'rfq', 'rfp', 'itb'];

const base = {
  reference_no: Joi.string().trim().max(50),
  type: Joi.string().valid(...TYPES),
  project_id: id.allow(null),
  location_id: id.allow(null),
  published_at: timestamp.allow(null),
  clarification_deadline: timestamp.allow(null),
  submission_deadline: timestamp,
  opening_date: timestamp.allow(null),
  submission_email: Joi.string().email().allow('', null),
  status: Joi.string().valid(...STATUS),
};

const tr = { slug, title: Joi.string().trim().max(300), description: text, instructions: text };

const { create, update } = makeSchemas({
  base,
  baseRequired: ['reference_no', 'type', 'submission_deadline'],
  tr,
  trRequired: ['title'],
});

const list = listQuery.keys({
  status: Joi.string().valid(...STATUS),
  type: Joi.string().valid(...TYPES),
  project_id: id,
  location_id: id,
});

/* documents (multipart) */
const documentBody = Joi.object({
  title: Joi.string().trim().max(250).allow('', null),
  doc_type: Joi.string().valid('tender_document', 'addendum', 'boq', 'specification', 'form', 'result').default('tender_document'),
  lang_code: langCode.allow('', null),
});

/* awards */
const awardBody = Joi.object({
  supplier_name: Joi.string().trim().max(250).required(),
  award_amount: Joi.number().precision(2).min(0).allow(null),
  currency: Joi.string().uppercase().length(3).default('USD'),
  awarded_at: dateOnly.allow(null),
  is_public: Joi.boolean().default(true),
});

module.exports = { create, update, list, documentBody, awardBody };
