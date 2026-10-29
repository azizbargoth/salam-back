const path = require('path');
require('dotenv').config();
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  DATABASE_URL: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  DEFAULT_LANG: Joi.string().valid('ar', 'en').default('ar'),
  CORS_ORIGINS: Joi.string().default('*'),
  UPLOAD_DIR: Joi.string().default('uploads'),
  PRIVATE_UPLOAD_DIR: Joi.string().default('private_uploads'),
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  console.error('Invalid environment configuration:\n - ' + error.details.map((d) => d.message).join('\n - '));
  process.exit(1);
}

module.exports = {
  ...value,
  isProd: value.NODE_ENV === 'production',
  corsOrigins: value.CORS_ORIGINS.split(',').map((s) => s.trim()),
  uploadDir: path.resolve(process.cwd(), value.UPLOAD_DIR),
  privateDir: path.resolve(process.cwd(), value.PRIVATE_UPLOAD_DIR),
};
