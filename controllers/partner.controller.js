const Partner = require('../model/Partner.model');
const crudController = require('./crud.factory');
const { getLogger } = require('../services/logger.service');

module.exports = crudController(Partner, { name: 'Partner', logger: getLogger('content') });
