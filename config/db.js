const { Pool } = require('pg');
const env = require('./env');
const logger = require('../services/logger.service').getLogger('db');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => logger.error(`Unexpected PostgreSQL error: ${err.message}`));

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  if (ms > 500) logger.warn(`Slow query (${ms}ms): ${text.replace(/\s+/g, ' ').slice(0, 150)}`);
  return res;
}

/** Run fn(client) inside a transaction. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function connect() {
  await pool.query('SELECT 1');
  logger.info('PostgreSQL connected');
}

module.exports = { pool, query, tx, connect };
