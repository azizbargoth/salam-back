const db = require('../config/db');

/** `client` may be a transaction client. */
async function create(d, client = db) {
  const { rows } = await client.query(
    `INSERT INTO job_applications (job_id, full_name, email, phone, cover_letter, cv_media_id, consent_given)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
    [d.job_id, d.full_name, d.email, d.phone ?? null, d.cover_letter ?? null, d.cv_media_id, d.consent_given]
  );
  return rows[0];
}

async function listByJob(jobId, { page = 1, limit = 20, status } = {}) {
  const params = [jobId];
  let where = 'WHERE a.job_id = $1';
  if (status) {
    params.push(status);
    where += ` AND a.status = $${params.length}`;
  }
  const total = (await db.query(`SELECT count(*)::int AS n FROM job_applications a ${where}`, params)).rows[0].n;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT a.id, a.job_id, a.full_name, a.email, a.phone, a.cover_letter, a.status, a.hr_notes,
            a.consent_given, a.created_at
     FROM job_applications a ${where}
     ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT a.*, m.storage_key AS cv_key, m.mime_type AS cv_mime
     FROM job_applications a LEFT JOIN media m ON m.id = a.cv_media_id WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function update(id, { status, hr_notes }) {
  const sets = [];
  const params = [];
  if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
  if (hr_notes !== undefined) { params.push(hr_notes); sets.push(`hr_notes = $${params.length}`); }
  if (!sets.length) return findById(id);
  params.push(id);
  const res = await db.query(`UPDATE job_applications SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return res.rowCount ? findById(id) : null;
}

/** Deletes the application and its CV media row. Returns { found, storage_key }. */
const remove = (id) =>
  db.tx(async (c) => {
    const a = await c.query('DELETE FROM job_applications WHERE id = $1 RETURNING cv_media_id', [id]);
    if (!a.rowCount) return { found: false, storage_key: null };
    let key = null;
    if (a.rows[0].cv_media_id) {
      const m = await c.query('DELETE FROM media WHERE id = $1 RETURNING storage_key', [a.rows[0].cv_media_id]);
      key = m.rows[0]?.storage_key || null;
    }
    return { found: true, storage_key: key };
  });

module.exports = { create, listByJob, findById, update, remove };
