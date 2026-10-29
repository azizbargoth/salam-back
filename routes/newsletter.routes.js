const router = require('express').Router();
const ctrl = require('../controllers/contact.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { formLimiter } = require('../middleware/rateLimit.middleware');
const v = require('../services/contact.validation.service');

router.post('/subscribe', formLimiter, validate(v.subscribe), ctrl.subscribe);
router.get('/confirm/:token', validate(v.tokenParams, 'params'), ctrl.confirm);
router.get('/unsubscribe/:token', validate(v.tokenParams, 'params'), ctrl.unsubscribe);
router.get('/subscribers', authenticate, authorize('editor'), validate(v.subscriberList, 'query'), ctrl.subscribers);

module.exports = router;
