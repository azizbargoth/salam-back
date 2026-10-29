const router = require('express').Router();
const ctrl = require('../controllers/media.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { mediaUpload } = require('../middleware/upload.middleware');
const { idParams } = require('../services/common.validation.service');
const v = require('../services/contact.validation.service');

router.use(authenticate, authorize('editor', 'hr', 'procurement'));

router.get('/', validate(v.mediaList, 'query'), ctrl.list);
router.post('/', mediaUpload, validate(v.mediaUploadBody), ctrl.upload);
router.delete('/:id', validate(idParams('uuid'), 'params'), ctrl.remove);

module.exports = router;
