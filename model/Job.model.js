const createTranslatableModel = require('./translatable.model');

module.exports = createTranslatableModel({
  table: 'jobs',
  trTable: 'job_translations',
  fk: 'job_id',
  cols: [
    'reference_no', 'office_id', 'location_id', 'sector_id', 'project_id', 'employment_type', 'openings',
    'posted_at', 'deadline_at', 'status', 'attachment_media_id', 'apply_url', 'created_by',
  ],
  trCols: ['slug', 'title', 'summary', 'responsibilities', 'qualifications', 'how_to_apply'],
  filterCols: ['status', 'employment_type', 'sector_id', 'office_id', 'location_id', 'project_id'],
  searchCols: ['title', 'summary'],
  sortable: ['deadline_at', 'posted_at', 'created_at'],
  defaultOrder: 'b.deadline_at DESC',
  publicWhere: `b.status IN ('open', 'closed')`,
  slugFrom: 'title',
  extraJoin: 'LEFT JOIN media am ON am.id = b.attachment_media_id',
  extraSelect: ', am.url AS attachment_url',
});
