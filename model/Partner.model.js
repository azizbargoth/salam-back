const createTranslatableModel = require('./translatable.model');

module.exports = createTranslatableModel({
  table: 'partners',
  trTable: 'partner_translations',
  fk: 'partner_id',
  cols: ['type', 'logo_media_id', 'website_url', 'sort_order', 'is_active', 'show_on_home'],
  trCols: ['name', 'description'],
  filterCols: ['type', 'show_on_home', 'is_active'],
  searchCols: ['name'],
  sortable: ['sort_order'],
  defaultOrder: 'b.sort_order ASC, b.id ASC',
  publicWhere: 'b.is_active',
  extraJoin: 'LEFT JOIN media lm ON lm.id = b.logo_media_id',
  extraSelect: ', lm.url AS logo_url',
});
