const db = require('../config/db');
const AppError = require('../utils/AppError');

const SELECT = `
  SELECT u.id, u.email, u.full_name, u.avatar_media_id, u.preferred_lang, u.status,
         u.last_login_at, u.created_at, u.updated_at,
         r.code AS role_code, r.name AS role_name, m.url AS avatar_url`;
const FROM = `
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN media m ON m.id = u.avatar_media_id`;

async function findById(id) {
  const { rows } = await db.query(`${SELECT} ${FROM} WHERE u.id = $1`, [id]);
  return rows[0] || null;
}

/** Includes password_hash — only for authentication. */
async function findByEmail(email) {
  const { rows } = await db.query(`${SELECT}, u.password_hash ${FROM} WHERE u.email = $1`, [email]);
  return rows[0] || null;
}

async function list({ page = 1, limit = 20, search, role_code, status } = {}) {
  const params = [];
  const where = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (role_code) {
    params.push(role_code);
    where.push(`r.code = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`u.status = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n ${FROM} ${whereSql}`, params)).rows[0].n;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `${SELECT} ${FROM} ${whereSql} ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function roleId(code) {
  const r = await db.query('SELECT id FROM roles WHERE code = $1', [code]);
  if (!r.rowCount) throw new AppError('Unknown role', 400);
  return r.rows[0].id;
}

async function create({ email, password_hash, full_name, role_code, preferred_lang = null, status = 'active' }) {
  const rid = await roleId(role_code);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, preferred_lang, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [email, password_hash, full_name, rid, preferred_lang, status]
  );
  return findById(rows[0].id);
}

async function update(id, data) {
  const sets = [];
  const params = [];
  const add = (col, val) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  for (const k of ['email', 'full_name', 'preferred_lang', 'status', 'avatar_media_id', 'password_hash']) {
    if (data[k] !== undefined) add(k, data[k]);
  }
  if (data.role_code !== undefined) add('role_id', await roleId(data.role_code));
  if (!sets.length) return findById(id);
  params.push(id);
  const res = await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  return res.rowCount ? findById(id) : null;
}

const touchLogin = (id) => db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);

const remove = async (id) => (await db.query('DELETE FROM users WHERE id = $1', [id])).rowCount > 0;

const listRoles = async () => (await db.query('SELECT id, code, name, description FROM roles ORDER BY id')).rows;

module.exports = { findById, findByEmail, list, create, update, touchLogin, remove, listRoles };
