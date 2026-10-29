const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { avatarUpload } = require('../middleware/upload.middleware');
const v = require('../services/user.validation.service');

router.use(authenticate);

// any logged-in user
router.patch('/me/avatar', avatarUpload, ctrl.uploadAvatar);

// super_admin only (authorize() with no roles)
router.use(authorize());
router.get('/roles', ctrl.roles);
router.get('/', validate(v.list, 'query'), ctrl.list);
router.post('/', validate(v.create), ctrl.create);
router.get('/:id', validate(v.idParams, 'params'), ctrl.getOne);
router.patch('/:id', validate(v.idParams, 'params'), validate(v.update), ctrl.update);
router.delete('/:id', validate(v.idParams, 'params'), ctrl.remove);

module.exports = router;
