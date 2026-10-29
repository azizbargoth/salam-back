const createTranslatableModel = require('./translatable.model');

module.exports = createTranslatableModel({
  table: 'sectors',
  trTable: 'sector_translations',
  fk: 'sector_id',
  cols: ['code', 'icon_media_id', 'cover_media_id', 'sort_order', 'is_active'],
  trCols: ['slug', 'name', 'summary', 'description', 'meta_title', 'meta_description'],
  filterCols: ['is_active'],
  searchCols: ['name', 'summary'],
  sortable: ['sort_order', 'code'],
  defaultOrder: 'b.sort_order ASC, b.id ASC',
  publicWhere: 'b.is_active',
  slugFrom: 'name',
  extraJoin: 'LEFT JOIN media im ON im.id = b.icon_media_id',
  extraSelect: ', im.url AS icon_url',
});
