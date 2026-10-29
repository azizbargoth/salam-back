const Announcement = require('../model/Announcement.model');
const crudController = require('./crud.factory');
const { getLogger } = require('../services/logger.service');

module.exports = crudController(Announcement, {
  name: 'Announcement',
  logger: getLogger('announcements'),
  prepare: (data, req, { isUpdate }) => {
    const out = { ...data };
    if (!isUpdate) out.created_by = req.user.id;
    if (out.status === 'published' && !out.published_at) out.published_at = new Date();
    return out;
  },
});
