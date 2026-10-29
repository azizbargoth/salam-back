const createTranslatableModel = require('./translatable.model');

module.exports = createTranslatableModel({
  table: 'announcements',
  trTable: 'announcement_translations',
  fk: 'announcement_id',
  cols: ['type', 'job_id', 'tender_id', 'attachment_media_id', 'status', 'published_at', 'expires_at', 'created_by'],
  trCols: ['slug', 'title', 'body'],
  filterCols: ['type', 'status', 'job_id', 'tender_id'],
  searchCols: ['title', 'body'],
  sortable: ['published_at', 'created_at'],
  defaultOrder: 'b.published_at DESC NULLS LAST, b.id DESC',
  publicWhere: `b.status = 'published' AND (b.published_at IS NULL OR b.published_at <= now())`,
  slugFrom: 'title',
  extraJoin: 'LEFT JOIN media am ON am.id = b.attachment_media_id',
  extraSelect: ', am.url AS attachment_url',
});
