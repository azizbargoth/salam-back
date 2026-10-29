const buildCrudRouter = require('./crud.router');
const controller = require('../controllers/sector.controller');
const v = require('../services/content.validation.service');

module.exports = buildCrudRouter({
  controller,
  schemas: { list: v.sectorList, create: v.sector.create, update: v.sector.update },
  roles: ['editor'],
});
