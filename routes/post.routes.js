const buildCrudRouter = require('./crud.router');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { formLimiter } = require('../middleware/rateLimit.middleware');
const { idParams, Joi, id } = require('../services/common.validation.service');
const controller = require('../controllers/post.controller');
const v = require('../services/post.validation.service');

const router = buildCrudRouter({
  controller,
  schemas: { list: v.list, create: v.create, update: v.update },
  roles: ['editor'],
  idType: 'uuid',
});

const staff = [authenticate, authorize('editor')];
const commentId = validate(Joi.object({ commentId: id.required() }), 'params');

// comments
router.get('/comments/moderation', ...staff, validate(v.commentList, 'query'), controller.moderationList);
router.patch('/comments/:commentId', ...staff, commentId, validate(v.commentModerate), controller.moderateComment);
router.delete('/comments/:commentId', ...staff, commentId, controller.removeComment);
router.get('/:id/comments', validate(idParams('uuid'), 'params'), validate(v.commentList, 'query'), controller.listComments);
router.post('/:id/comments', formLimiter, validate(idParams('uuid'), 'params'), validate(v.commentCreate), controller.addComment);

module.exports = router;
