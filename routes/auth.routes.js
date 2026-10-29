const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const v = require('../services/auth.validation.service');

router.post('/login', authLimiter, validate(v.login), ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.post('/change-password', authenticate, validate(v.changePassword), ctrl.changePassword);
router.post('/logout', authenticate, ctrl.logout);

module.exports = router;
