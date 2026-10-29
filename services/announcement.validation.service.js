const { Joi, slug, id, uuid, text, timestamp, listQuery, makeSchemas } = require('./common.validation.service');

const STATUS = ['draft', 'scheduled', 'published', 'archived'];
const TYPES = ['general', 'recruitment_result', 'tender_result', 'notice', 'policy'];

const base = {
  type: Joi.string().valid(...TYPES),
  job_id: id.allow(null),
  tender_id: id.allow(null),
  attachment_media_id: uuid.allow(null),
  status: Joi.string().valid(...STATUS),
  published_at: timestamp.allow(null),
  expires_at: timestamp.allow(null),
};

const tr = { slug, title: Joi.string().trim().max(300), body: text };

const { create, update } = makeSchemas({ base, tr, trRequired: ['title'] });

const list = listQuery.keys({
  type: Joi.string().valid(...TYPES),
  status: Joi.string().valid(...STATUS),
  job_id: id,
  tender_id: id,
});

module.exports = { create, update, list };
