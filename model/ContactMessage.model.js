const db = require('../config/db');

async function create(d) {
  const { rows } = await db.query(
    `INSERT INTO contact_messages (name, email, phone, subject, message, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
    [d.name, d.email, d.phone ?? null, d.subject ?? null, d.message, d.ip_hash ?? null]
  );
  return rows[0];
}

async function list({ page = 1, limit = 20, status, search } = {}) {
  const params = [];
  const where = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR subject ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM contact_messages ${whereSql}`, params)).rows[0].n;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT * FROM contact_messages ${whereSql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

const findById = async (id) => (await db.query('SELECT * FROM contact_messages WHERE id = $1', [id])).rows[0] || null;

async function update(id, { status, assigned_to }) {
  const sets = [];
  const params = [];
  if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
  if (assigned_to !== undefined) { params.push(assigned_to); sets.push(`assigned_to = $${params.length}`); }
  if (!sets.length) return findById(id);
  params.push(id);
  const res = await db.query(`UPDATE contact_messages SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return res.rowCount ? findById(id) : null;
}

const remove = async (id) => (await db.query('DELETE FROM contact_messages WHERE id = $1', [id])).rowCount > 0;

module.exports = { create, list, findById, update, remove };
