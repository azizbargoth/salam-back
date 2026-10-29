const { Joi, slug, id, uuid, text, dateOnly, timestamp, listQuery, makeSchemas } = require('./common.validation.service');

const STATUS = ['draft', 'scheduled', 'published', 'archived'];

const base = {
  category_id: id.allow(null),
  project_id: id.allow(null),
  sector_id: id.allow(null),
  location_id: id.allow(null),
  featured_media_id: uuid.allow(null),
  status: Joi.string().valid(...STATUS),
  is_featured: Joi.boolean(),
  allow_comments: Joi.boolean(),
  event_date: dateOnly.allow(null),
  published_at: timestamp.allow(null),
  tag_ids: Joi.array().items(id).unique(),
};

const tr = {
  slug,
  title: Joi.string().trim().max(300),
  excerpt: text,
  content: Joi.string(),
  meta_title: Joi.string().max(200).allow('', null),
  meta_description: Joi.string().max(320).allow('', null),
};

const { create, update } = makeSchemas({ base, tr, trRequired: ['title', 'content'] });

const list = listQuery.keys({
  category_id: id,
  project_id: id,
  sector_id: id,
  location_id: id,
  is_featured: Joi.boolean(),
  status: Joi.string().valid(...STATUS), // only meaningful for the admin list
});

/* comments */
const commentCreate = Joi.object({
  author_name: Joi.string().trim().min(2).max(100).required(),
  author_email: Joi.string().email().lowercase().required(),
  body: Joi.string().trim().min(2).max(2000).required(),
  parent_id: Joi.number().integer().positive().allow(null),
});
const commentList = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'spam'),
});
const commentModerate = Joi.object({ status: Joi.string().valid('pending', 'approved', 'rejected', 'spam').required() });

module.exports = { create, update, list, commentCreate, commentList, commentModerate };
