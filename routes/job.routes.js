const buildCrudRouter = require('./crud.router');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { cvUpload } = require('../middleware/upload.middleware');
const { applyLimiter } = require('../middleware/rateLimit.middleware');
const { idParams } = require('../services/common.validation.service');
const controller = require('../controllers/job.controller');
const v = require('../services/job.validation.service');

const router = buildCrudRouter({
  controller,
  schemas: { list: v.list, create: v.create, update: v.update },
  roles: ['hr'],
});

const hr = [authenticate, authorize('hr')];
const jobId = validate(idParams('int'), 'params');
const appId = validate(idParams('uuid', 'appId'), 'params');

// public: apply for a vacancy (multipart: fields + file "cv")
router.post('/:id/apply', applyLimiter, cvUpload, jobId, validate(v.apply), controller.apply);

// HR: manage applications
router.get('/:id/applications', ...hr, jobId, validate(v.applicationList, 'query'), controller.listApplications);
router.get('/applications/:appId/cv', ...hr, appId, controller.downloadCv);
router.patch('/applications/:appId', ...hr, appId, validate(v.applicationUpdate), controller.updateApplication);
router.delete('/applications/:appId', ...hr, appId, controller.removeApplication);

module.exports = router;
