const Sector = require('../model/Sector.model');
const crudController = require('./crud.factory');
const { getLogger } = require('../services/logger.service');

module.exports = crudController(Sector, { name: 'Sector', logger: getLogger('content') });
