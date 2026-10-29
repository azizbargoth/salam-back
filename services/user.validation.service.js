const { Joi, langCode, uuid, listQuery } = require('./common.validation.service');
const { password } = require('./auth.validation.service');

const ROLES = ['super_admin', 'editor', 'hr', 'procurement'];

const create = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: password.required(),
  full_name: Joi.string().trim().min(2).max(150).required(),
  role_code: Joi.string().valid(...ROLES).required(),
  preferred_lang: langCode.allow(null),
  status: Joi.string().valid('active', 'suspended', 'invited').default('active'),
});

const update = Joi.object({
  email: Joi.string().email().lowercase(),
  password,
  full_name: Joi.string().trim().min(2).max(150),
  role_code: Joi.string().valid(...ROLES),
  preferred_lang: langCode.allow(null),
  status: Joi.string().valid('active', 'suspended', 'invited'),
}).min(1);

const list = listQuery.keys({
  limit: Joi.number().integer().min(1).max(100).default(20),
  role_code: Joi.string().valid(...ROLES),
  status: Joi.string().valid('active', 'suspended', 'invited'),
});

module.exports = { ROLES, create, update, list, idParams: Joi.object({ id: uuid.required() }) };
