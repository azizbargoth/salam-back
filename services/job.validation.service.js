const { Joi, slug, id, uuid, text, timestamp, listQuery, makeSchemas } = require('./common.validation.service');

const STATUS = ['draft', 'open', 'closed', 'cancelled'];
const EMPLOYMENT = ['full_time', 'part_time', 'consultancy', 'volunteer', 'internship'];
const APP_STATUS = ['received', 'shortlisted', 'interviewed', 'rejected', 'hired'];

const base = {
  reference_no: Joi.string().trim().max(50),
  office_id: id.allow(null),
  location_id: id.allow(null),
  sector_id: id.allow(null),
  project_id: id.allow(null),
  employment_type: Joi.string().valid(...EMPLOYMENT),
  openings: Joi.number().integer().min(1).max(500),
  posted_at: timestamp.allow(null),
  deadline_at: timestamp,
  status: Joi.string().valid(...STATUS),
  attachment_media_id: uuid.allow(null),
  apply_url: Joi.string().uri().max(500).allow('', null),
};

const tr = {
  slug,
  title: Joi.string().trim().max(250),
  summary: text,
  responsibilities: text,
  qualifications: text,
  how_to_apply: text,
};

const { create, update } = makeSchemas({
  base,
  baseRequired: ['reference_no', 'deadline_at'],
  tr,
  trRequired: ['title'],
});

const list = listQuery.keys({
  status: Joi.string().valid(...STATUS),
  employment_type: Joi.string().valid(...EMPLOYMENT),
  sector_id: id,
  office_id: id,
  location_id: id,
  project_id: id,
});

/* applications (multipart form: text fields arrive as strings, Joi converts them) */
const apply = Joi.object({
  full_name: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().trim().max(40).allow('', null),
  cover_letter: Joi.string().trim().max(5000).allow('', null),
  consent_given: Joi.boolean().valid(true).required().messages({ 'any.only': 'consent is required to apply' }),
});

const applicationList = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...APP_STATUS),
});

const applicationUpdate = Joi.object({
  status: Joi.string().valid(...APP_STATUS),
  hr_notes: Joi.string().max(5000).allow('', null),
}).min(1);

module.exports = { create, update, list, apply, applicationList, applicationUpdate };
