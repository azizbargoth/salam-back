const buildCrudRouter = require('./crud.router');
const controller = require('../controllers/project.controller');
const v = require('../services/project.validation.service');

module.exports = buildCrudRouter({
  controller,
  schemas: { list: v.list, create: v.create, update: v.update },
  roles: ['editor'],
});
