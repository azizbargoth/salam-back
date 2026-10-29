/**
 * Generic model for "base table + <table>_translations" pairs.
 * Gives every entity: list / findById / findBySlug / translations / alternates /
 * create / update / remove, plus many-to-many "relations" (tag_ids, sector_ids ...).
 *
 * Language fallback: requested lang -> DEFAULT_LANG -> any available translation.
 */
const db = require('../config/db');
const env = require('../config/env');
const slugify = require('../utils/slugify');

const pick = (obj = {}, keys) => {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

module.exports = function createTranslatableModel(cfg) {
  const {
    table,
    trTable,
    fk,
    idType = 'int', // 'int' | 'uuid' (type of the base table id)
    cols,
    trCols,
    filterCols = [],
    searchCols = [],
    sortable = [],
    defaultOrder = 'b.id DESC',
    publicWhere = null,
    relations = [],
    extraJoin = '',
    extraSelect = '',
    slugFrom = null,
  } = cfg;

  const trSelect = trCols.map((c) => `t.${c}`).join(', ');
  const lateral = `LEFT JOIN LATERAL (
      SELECT x.* FROM ${trTable} x WHERE x.${fk} = b.id
      ORDER BY (x.lang_code = $1) DESC, (x.lang_code = $2) DESC, x.lang_code
      LIMIT 1) t ON true`;
  const selectSql = `SELECT b.*, ${trSelect}, t.lang_code AS lang${extraSelect}`;
  const hasSlug = trCols.includes('slug');

  async function loadRelations(item) {
    for (const r of relations) {
      const params = [item.id];
      let sql = `SELECT ${r.col} AS v FROM ${r.table} WHERE ${r.fk} = $1`;
      if (r.extra) {
        const [ek, ev] = Object.entries(r.extra)[0];
        params.push(ev);
        sql += ` AND ${ek} = $2`;
      }
      item[r.name] = (await db.query(sql, params)).rows.map((x) => x.v);
    }
    return item;
  }

  async function syncRelations(c, id, data) {
    for (const r of relations) {
      const ids = data[r.name];
      if (ids === undefined) continue;
      const [ek, ev] = r.extra ? Object.entries(r.extra)[0] : [];
      await c.query(
        `DELETE FROM ${r.table} WHERE ${r.fk} = $1${ek ? ` AND ${ek} = $2` : ''}`,
        ek ? [id, ev] : [id]
      );
      if (ids.length) {
        await c.query(
          `INSERT INTO ${r.table} (${r.fk}, ${r.col}${ek ? `, ${ek}` : ''})
           SELECT $1::${idType}, unnest($2::${r.type || 'int'}[])${ek ? ', $3' : ''}`,
          ek ? [id, ids, ev] : [id, ids]
        );
      }
    }
  }

  /** UPDATE the translation row; INSERT it if this language does not exist yet. */
  async function upsertTranslation(c, id, tr) {
    const t = pick(tr, trCols);
    const keys = Object.keys(t);
    let updated = 0;
    if (keys.length) {
      const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const res = await c.query(
        `UPDATE ${trTable} SET ${sets} WHERE ${fk} = $${keys.length + 1} AND lang_code = $${keys.length + 2}`,
        [...keys.map((k) => t[k]), id, tr.lang_code]
      );
      updated = res.rowCount;
    } else {
      updated = (await c.query(`SELECT 1 FROM ${trTable} WHERE ${fk} = $1 AND lang_code = $2`, [id, tr.lang_code]))
        .rowCount;
    }
    if (updated) return;

    if (hasSlug && !t.slug && slugFrom && t[slugFrom]) t.slug = slugify(t[slugFrom]);
    const insKeys = Object.keys(t);
    await c.query(
      `INSERT INTO ${trTable} (${fk}, lang_code${insKeys.length ? ', ' + insKeys.join(', ') : ''})
       VALUES ($1, $2${insKeys.map((_, i) => `, $${i + 3}`).join('')})`,
      [id, tr.lang_code, ...insKeys.map((k) => t[k])]
    );
  }

  async function list({ lang = env.DEFAULT_LANG, page = 1, limit = 12, filters = {}, search, sort, publicOnly = true } = {}) {
    const params = [lang, env.DEFAULT_LANG];
    const where = [];
    if (publicOnly && publicWhere) where.push(`(${publicWhere})`);
    for (const k of filterCols) {
      if (filters[k] !== undefined && filters[k] !== null) {
        params.push(filters[k]);
        where.push(`b.${k} = $${params.length}`);
      }
    }
    if (search && searchCols.length) {
      params.push(`%${search}%`);
      where.push(`(${searchCols.map((c) => `t.${c} ILIKE $${params.length}`).join(' OR ')})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT count(*)::int AS n FROM ${table} b ${lateral} ${whereSql}`, params);
    const total = countRes.rows[0].n;

    let order = defaultOrder;
    if (sort) {
      const desc = sort.startsWith('-');
      const col = sort.replace(/^-/, '');
      if (sortable.includes(col)) order = `b.${col} ${desc ? 'DESC' : 'ASC'}`;
    }

    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(
      `${selectSql} FROM ${table} b ${lateral} ${extraJoin} ${whereSql}
       ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async function findById(id, { lang = env.DEFAULT_LANG, publicOnly = true } = {}) {
    const { rows } = await db.query(
      `${selectSql} FROM ${table} b ${lateral} ${extraJoin}
       WHERE b.id = $3 ${publicOnly && publicWhere ? `AND (${publicWhere})` : ''}`,
      [lang, env.DEFAULT_LANG, id]
    );
    return rows[0] ? loadRelations(rows[0]) : null;
  }

  async function findBySlug(slug, opts = {}) {
    if (!hasSlug) return null;
    const { rows } = await db.query(
      `SELECT ${fk} AS id FROM ${trTable} WHERE slug = $1 ORDER BY (lang_code = $2) DESC LIMIT 1`,
      [slug, opts.lang || env.DEFAULT_LANG]
    );
    return rows[0] ? findById(rows[0].id, opts) : null;
  }

  const translations = async (id) =>
    (await db.query(`SELECT * FROM ${trTable} WHERE ${fk} = $1 ORDER BY lang_code`, [id])).rows;

  /** Slugs in every language (for hreflang / language switcher). */
  const alternates = async (id) =>
    hasSlug ? (await db.query(`SELECT lang_code, slug FROM ${trTable} WHERE ${fk} = $1`, [id])).rows : [];

  async function create(data = {}, trs = []) {
    return db.tx(async (c) => {
      const base = pick(data, cols);
      const keys = Object.keys(base);
      const sql = keys.length
        ? `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`
        : `INSERT INTO ${table} DEFAULT VALUES RETURNING id`;
      const { rows } = await c.query(sql, keys.map((k) => base[k]));
      const id = rows[0].id;
      for (const tr of trs) await upsertTranslation(c, id, tr);
      await syncRelations(c, id, data);
      return id;
    });
  }

  /** Returns false when the row does not exist. */
  async function update(id, data = {}, trs = []) {
    return db.tx(async (c) => {
      const exists = await c.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
      if (!exists.rowCount) return false;
      const base = pick(data, cols);
      const keys = Object.keys(base);
      if (keys.length) {
        await c.query(
          `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`,
          [...keys.map((k) => base[k]), id]
        );
      }
      for (const tr of trs || []) await upsertTranslation(c, id, tr);
      await syncRelations(c, id, data);
      return true;
    });
  }

  const remove = async (id) => (await db.query(`DELETE FROM ${table} WHERE id = $1`, [id])).rowCount > 0;

  return { list, findById, findBySlug, translations, alternates, create, update, remove };
};
