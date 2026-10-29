const db = require('../config/db');
const createTranslatableModel = require('./translatable.model');

const Tender = createTranslatableModel({
  table: 'tenders',
  trTable: 'tender_translations',
  fk: 'tender_id',
  cols: [
    'reference_no', 'type', 'project_id', 'location_id', 'published_at', 'clarification_deadline',
    'submission_deadline', 'opening_date', 'submission_email', 'status', 'created_by',
  ],
  trCols: ['slug', 'title', 'description', 'instructions'],
  filterCols: ['status', 'type', 'project_id', 'location_id'],
  searchCols: ['title', 'description'],
  sortable: ['submission_deadline', 'published_at', 'created_at'],
  defaultOrder: 'b.submission_deadline DESC',
  publicWhere: `b.status IN ('open', 'closed', 'awarded')`,
  slugFrom: 'title',
});

/* ------------------------------ Documents ------------------------------ */

Tender.documents = async (tenderId) =>
  (
    await db.query(
      `SELECT d.id, d.doc_type, d.lang_code, d.title, d.created_at, m.url, m.mime_type, m.size_bytes
       FROM tender_documents d JOIN media m ON m.id = d.media_id
       WHERE d.tender_id = $1 ORDER BY d.id`,
      [tenderId]
    )
  ).rows;

Tender.addDocument = async (client, tenderId, mediaId, { doc_type = 'tender_document', lang_code = null, title = null }) =>
  (
    await client.query(
      `INSERT INTO tender_documents (tender_id, media_id, doc_type, lang_code, title)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenderId, mediaId, doc_type, lang_code, title]
    )
  ).rows[0];

/** Deletes the document and its media row; returns the media storage_key (or null if not found). */
Tender.removeDocument = (docId) =>
  db.tx(async (c) => {
    const d = await c.query('DELETE FROM tender_documents WHERE id = $1 RETURNING media_id', [docId]);
    if (!d.rowCount) return null;
    const m = await c.query('DELETE FROM media WHERE id = $1 RETURNING storage_key', [d.rows[0].media_id]);
    return m.rows[0]?.storage_key || '';
  });

/* ------------------------------- Awards -------------------------------- */

Tender.awards = async (tenderId, { publicOnly = true } = {}) =>
  (
    await db.query(
      `SELECT id, supplier_name, award_amount, currency, awarded_at, is_public
       FROM tender_awards WHERE tender_id = $1 ${publicOnly ? 'AND is_public' : ''} ORDER BY id`,
      [tenderId]
    )
  ).rows;

Tender.addAward = async (tenderId, a) =>
  (
    await db.query(
      `INSERT INTO tender_awards (tender_id, supplier_name, award_amount, currency, awarded_at, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenderId, a.supplier_name, a.award_amount ?? null, a.currency || 'USD', a.awarded_at ?? null, a.is_public ?? true]
    )
  ).rows[0];

Tender.removeAward = async (id) => (await db.query('DELETE FROM tender_awards WHERE id = $1', [id])).rowCount > 0;

module.exports = Tender;
