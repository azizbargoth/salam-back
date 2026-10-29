const router = require('express').Router();
const ctrl = require('../controllers/contact.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { formLimiter } = require('../middleware/rateLimit.middleware');
const { idParams } = require('../services/common.validation.service');
const v = require('../services/contact.validation.service');

const staff = [authenticate, authorize('editor')];

router.post('/', formLimiter, validate(v.contactCreate), ctrl.submit);
router.get('/', ...staff, validate(v.contactList, 'query'), ctrl.list);
router.get('/:id', ...staff, validate(idParams('uuid'), 'params'), ctrl.getOne);
router.patch('/:id', ...staff, validate(idParams('uuid'), 'params'), validate(v.contactUpdate), ctrl.update);
router.delete('/:id', ...staff, validate(idParams('uuid'), 'params'), ctrl.remove);

module.exports = router;
