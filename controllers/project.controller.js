const Project = require('../model/Project.model');
const crudController = require('./crud.factory');
const { getLogger } = require('../services/logger.service');

module.exports = crudController(Project, { name: 'Project', logger: getLogger('projects') });
