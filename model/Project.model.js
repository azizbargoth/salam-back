const createTranslatableModel = require('./translatable.model');

module.exports = createTranslatableModel({
  table: 'projects',
  trTable: 'project_translations',
  fk: 'project_id',
  cols: [
    'code', 'status', 'start_date', 'end_date', 'budget_amount', 'budget_currency', 'show_budget',
    'beneficiaries_total', 'beneficiaries_women', 'beneficiaries_men', 'beneficiaries_girls',
    'beneficiaries_boys', 'cover_media_id', 'is_featured', 'visibility',
  ],
  trCols: ['slug', 'title', 'summary', 'objectives', 'description', 'results', 'meta_title', 'meta_description'],
  filterCols: ['status', 'is_featured', 'visibility'],
  searchCols: ['title', 'summary'],
  sortable: ['start_date', 'end_date', 'created_at'],
  defaultOrder: 'b.start_date DESC NULLS LAST, b.id DESC',
  publicWhere: `b.visibility = 'published'`,
  slugFrom: 'title',
  extraJoin: 'LEFT JOIN media cm ON cm.id = b.cover_media_id',
  extraSelect: ', cm.url AS cover_image',
  relations: [
    { name: 'sector_ids', table: 'project_sectors', fk: 'project_id', col: 'sector_id', type: 'smallint' },
    { name: 'location_ids', table: 'project_locations', fk: 'project_id', col: 'location_id', type: 'int' },
    {
      name: 'donor_ids', table: 'project_partners', fk: 'project_id', col: 'partner_id', type: 'int',
      extra: { role: 'donor' },
    },
  ],
});
