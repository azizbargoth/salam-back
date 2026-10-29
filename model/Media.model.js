const db = require('../config/db');
const { PRIVATE_PREFIX } = require('../services/media.service');

/** `client` may be a transaction client (same .query signature as db). */
async function create(d, client = db) {
  const { rows } = await client.query(
    `INSERT INTO media (kind, storage_key, url, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [d.kind, d.storage_key, d.url, d.mime_type, d.size_bytes, d.uploaded_by]
  );
  return rows[0];
}

const setAlt = (client, mediaId, lang, alt, caption = null) =>
  client.query(
    `INSERT INTO media_translations (media_id, lang_code, alt_text, caption) VALUES ($1, $2, $3, $4)
     ON CONFLICT (media_id, lang_code) DO UPDATE SET alt_text = EXCLUDED.alt_text, caption = EXCLUDED.caption`,
    [mediaId, lang, alt, caption]
  );

const findById = async (id) => (await db.query('SELECT * FROM media WHERE id = $1', [id])).rows[0] || null;

async function list({ page = 1, limit = 24, kind } = {}) {
  const params = [`${PRIVATE_PREFIX}%`];
  let where = 'WHERE storage_key NOT LIKE $1';
  if (kind) {
    params.push(kind);
    where += ` AND kind = $${params.length}`;
  }
  const total = (await db.query(`SELECT count(*)::int AS n FROM media ${where}`, params)).rows[0].n;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT * FROM media ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

/** Deletes the row and returns it (so the caller can delete the file). */
const remove = async (id, client = db) =>
  (await client.query('DELETE FROM media WHERE id = $1 RETURNING *', [id])).rows[0] || null;

module.exports = { create, setAlt, findById, list, remove };
