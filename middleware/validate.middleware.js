const AppError = require('../utils/AppError');

/**
 * validate(schema, 'body' | 'query' | 'params')
 * Result is stored in req.validated[source] (works on Express 4 and 5).
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source] || {}, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
    return next(new AppError('Validation failed', 422, details));
  }
  req.validated = req.validated || {};
  req.validated[source] = value;
  next();
};

module.exports = validate;
