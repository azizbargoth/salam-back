const buildCrudRouter = require('./crud.router');
const controller = require('../controllers/announcement.controller');
const v = require('../services/announcement.validation.service');

module.exports = buildCrudRouter({
  controller,
  schemas: { list: v.list, create: v.create, update: v.update },
  roles: ['editor', 'hr', 'procurement'],
});
