const { Joi, slug, uuid, text, listQuery, makeSchemas } = require('./common.validation.service');

/* ------------------------------- Sectors ------------------------------- */
const sectorBase = {
  code: Joi.string().trim().lowercase().pattern(/^[a-z0-9_]+$/).max(30),
  icon_media_id: uuid.allow(null),
  cover_media_id: uuid.allow(null),
  sort_order: Joi.number().integer().min(0).max(32000),
  is_active: Joi.boolean(),
};
const sectorTr = {
  slug,
  name: Joi.string().trim().max(120),
  summary: text,
  description: text,
  meta_title: Joi.string().max(200).allow('', null),
  meta_description: Joi.string().max(320).allow('', null),
};
const sector = makeSchemas({ base: sectorBase, baseRequired: ['code'], tr: sectorTr, trRequired: ['name'] });
const sectorList = listQuery.keys({ is_active: Joi.boolean() });

/* ------------------------------- Partners ------------------------------ */
const PARTNER_TYPES = ['donor', 'partner', 'network', 'government'];
const partnerBase = {
  type: Joi.string().valid(...PARTNER_TYPES),
  logo_media_id: uuid.allow(null),
  website_url: Joi.string().uri().max(500).allow('', null),
  sort_order: Joi.number().integer().min(0).max(32000),
  is_active: Joi.boolean(),
  show_on_home: Joi.boolean(),
};
const partnerTr = { name: Joi.string().trim().max(200), description: text };
const partner = makeSchemas({ base: partnerBase, tr: partnerTr, trRequired: ['name'] });
const partnerList = listQuery.keys({
  type: Joi.string().valid(...PARTNER_TYPES),
  show_on_home: Joi.boolean(),
  is_active: Joi.boolean(),
});

module.exports = { sector, sectorList, partner, partnerList };
