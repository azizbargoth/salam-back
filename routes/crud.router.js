const express = require('express');
const validate = require('../middleware/validate.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { idParams, keyParams, langQuery } = require('../services/common.validation.service');

/**
 * Standard routes for a translatable entity:
 *   GET    /                 public list
 *   GET    /:key             public detail (id or slug)
 *   GET    /admin/list       staff list incl. drafts
 *   GET    /admin/:id        staff detail incl. all translations
 *   POST   /                 create
 *   PATCH  /:id              update
 *   DELETE /:id              delete
 * Extra multi-segment routes can be added to the returned router afterwards.
 */
module.exports = function buildCrudRouter({ controller, schemas, roles, idType = 'int' }) {
  const router = express.Router();
  const staff = [authenticate, authorize(...roles)];
  const id = validate(idParams(idType), 'params');

  router.get('/', validate(schemas.list, 'query'), controller.list);
  router.get('/admin/list', ...staff, validate(schemas.list, 'query'), controller.adminList);
  router.get('/admin/:id', ...staff, id, validate(langQuery, 'query'), controller.adminGet);
  router.post('/', ...staff, validate(schemas.create), controller.create);
  router.patch('/:id', ...staff, id, validate(schemas.update), controller.update);
  router.delete('/:id', ...staff, id, controller.remove);
  router.get('/:key', validate(keyParams, 'params'), validate(langQuery, 'query'), controller.getOne);

  return router;
};
