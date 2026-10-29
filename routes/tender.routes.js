const buildCrudRouter = require('./crud.router');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { documentUpload } = require('../middleware/upload.middleware');
const { Joi, id, idParams } = require('../services/common.validation.service');
const controller = require('../controllers/tender.controller');
const v = require('../services/tender.validation.service');

const router = buildCrudRouter({
  controller,
  schemas: { list: v.list, create: v.create, update: v.update },
  roles: ['procurement'],
});

const staff = [authenticate, authorize('procurement')];
const tenderId = validate(idParams('int'), 'params');

// documents (ITB, BoQ, addenda ...)
router.post('/:id/documents', ...staff, documentUpload, tenderId, validate(v.documentBody), controller.addDocument);
router.delete('/documents/:docId', ...staff, validate(Joi.object({ docId: id.required() }), 'params'), controller.removeDocument);

// awards (published results)
router.get('/:id/awards', tenderId, controller.listAwards);
router.post('/:id/awards', ...staff, tenderId, validate(v.awardBody), controller.addAward);
router.delete('/awards/:awardId', ...staff, validate(Joi.object({ awardId: id.required() }), 'params'), controller.removeAward);

module.exports = router;
