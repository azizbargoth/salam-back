const { Joi, langCode, uuid } = require('./common.validation.service');

const MSG_STATUS = ['new', 'read', 'replied', 'spam', 'archived'];

const contactCreate = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().trim().max(40).allow('', null),
  subject: Joi.string().trim().max(250).allow('', null),
  message: Joi.string().trim().min(10).max(5000).required(),
  // honeypot: hidden field in the form; real users leave it empty, bots fill it -> rejected
  website: Joi.string().allow('').max(0),
});

const contactUpdate = Joi.object({
  status: Joi.string().valid(...MSG_STATUS),
  assigned_to: uuid.allow(null),
}).min(1);

const contactList = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...MSG_STATUS),
  search: Joi.string().trim().max(100),
});

const subscribe = Joi.object({
  email: Joi.string().email().lowercase().required(),
  lang_code: langCode,
});

const tokenParams = Joi.object({ token: Joi.string().hex().length(48).required() });

const subscriberList = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
  confirmed: Joi.boolean(),
});

const mediaUploadBody = Joi.object({
  lang_code: langCode.default('ar'),
  alt_text: Joi.string().trim().max(300).allow('', null),
  caption: Joi.string().trim().max(1000).allow('', null),
});

const mediaList = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
  kind: Joi.string().valid('image', 'video', 'document', 'audio', 'other'),
});

module.exports = {
  contactCreate, contactUpdate, contactList, subscribe, tokenParams, subscriberList, mediaUploadBody, mediaList,
};
