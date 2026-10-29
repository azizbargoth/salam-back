const crypto = require('crypto');
const db = require('../config/db');

/** Creates or re-activates a subscription. Returns the row incl. token (to email the confirmation link). */
async function subscribe(email, lang = null) {
  const token = crypto.randomBytes(24).toString('hex');
  const { rows } = await db.query(
    `INSERT INTO newsletter_subscribers (email, lang_code, confirm_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET lang_code = COALESCE(EXCLUDED.lang_code, newsletter_subscribers.lang_code),
           unsubscribed_at = NULL,
           confirm_token = COALESCE(newsletter_subscribers.confirm_token, EXCLUDED.confirm_token)
     RETURNING id, email, is_confirmed, confirm_token`,
    [email, lang, token]
  );
  return rows[0];
}

const confirm = async (token) =>
  (
    await db.query(
      `UPDATE newsletter_subscribers SET is_confirmed = true
       WHERE confirm_token = $1 AND unsubscribed_at IS NULL RETURNING id`,
      [token]
    )
  ).rowCount > 0;

const unsubscribe = async (token) =>
  (
    await db.query(
      `UPDATE newsletter_subscribers SET unsubscribed_at = now()
       WHERE confirm_token = $1 RETURNING id`,
      [token]
    )
  ).rowCount > 0;

async function list({ page = 1, limit = 50, confirmed } = {}) {
  const params = [];
  let where = 'WHERE unsubscribed_at IS NULL';
  if (confirmed !== undefined) {
    params.push(confirmed);
    where += ` AND is_confirmed = $${params.length}`;
  }
  const total = (await db.query(`SELECT count(*)::int AS n FROM newsletter_subscribers ${where}`, params)).rows[0].n;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT id, email, lang_code, is_confirmed, created_at FROM newsletter_subscribers ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { subscribe, confirm, unsubscribe, list };
