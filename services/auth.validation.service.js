const { Joi } = require('./common.validation.service');

const password = Joi.string()
  .min(8)
  .max(72) // bcrypt only uses the first 72 bytes
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/\d/, 'digit')
  .messages({
    'string.pattern.name': 'password must contain at least one letter and one number',
  });

const login = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const changePassword = Joi.object({
  current_password: Joi.string().required(),
  new_password: password.required(),
});

module.exports = { password, login, changePassword };
