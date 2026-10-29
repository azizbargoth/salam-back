const buildCrudRouter = require('./crud.router');
const controller = require('../controllers/partner.controller');
const v = require('../services/content.validation.service');

module.exports = buildCrudRouter({
  controller,
  schemas: { list: v.partnerList, create: v.partner.create, update: v.partner.update },
  roles: ['editor'],
});
