// tests/integration/helpers/db-test.js
// ═══════════════════════════════════════════════════════════════
// Integration test database helper.
// Connects to a REAL MySQL instance (not the mocked one).
// Uses a separate test database to avoid polluting dev/prod data.
//
// Required env vars (set in .env.test or export before running):
//   TEST_DB_HOST     (default: localhost)
//   TEST_DB_PORT     (default: 3306)
//   TEST_DB_USER     (default: nu_app)
//   TEST_DB_PASSWORD (default: '')
//   TEST_DB_NAME     (default: nu_pmc_test)
//
// Each test file should:
//   1. Import { pool, tx, setup, teardown } from this helper
//   2. Call setup() in beforeAll — loads schema + seed
//   3. Call teardown() in afterAll — closes connection pool
//   4. Wrap each test in a transaction that rolls back (no side-effects)
// ═══════════════════════════════════════════════════════════════

'use strict';

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const config = {
  host:     process.env.TEST_DB_HOST     || 'localhost',
  port:     parseInt(process.env.TEST_DB_PORT, 10) || 3306,
  user:     process.env.TEST_DB_USER     || 'nu_app',
  password: process.env.TEST_DB_PASSWORD || '',
  database: process.env.TEST_DB_NAME     || 'nu_pmc_test',
  charset:  'utf8mb4',
  timezone: '+05:30',
  waitForConnections: true,
  connectionLimit: 5,
  multipleStatements: true,   // needed for schema.sql import
};

let pool;

/**
 * Initialise the test database: drop + recreate, load schema.sql,
 * optionally load dev-seed.sql.
 */
async function setup({ seed = false } = {}) {
  // Create pool with multipleStatements for schema loading
  const adminPool = mysql.createPool({ ...config, database: undefined, multipleStatements: true });
  try {
    await adminPool.query(`DROP DATABASE IF EXISTS \`${config.database}\``);
    await adminPool.query(`CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await adminPool.end();
  }

  pool = mysql.createPool(config);

  // Load schema
  const schemaPath = path.resolve(__dirname, '../../../schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Split on delimiter boundaries to handle stored procedures etc.
    // Simple approach: execute the whole thing with multipleStatements.
    const schemaPool = mysql.createPool({ ...config, multipleStatements: true });
    try {
      await schemaPool.query(schema);
    } finally {
      await schemaPool.end();
    }
  }

  // Optional seed data
  if (seed) {
    const seedPath = path.resolve(__dirname, '../../../dev-seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      const seedPool = mysql.createPool({ ...config, multipleStatements: true });
      try {
        await seedPool.query(seedSql);
      } finally {
        await seedPool.end();
      }
    }
  }

  // Add tx helper matching middleware/db.js contract
  pool.tx = async (fn) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      throw err;
    } finally {
      conn.release();
    }
  };

  return pool;
}

/**
 * Close the pool. Call in afterAll.
 */
async function teardown() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Run a test function inside a transaction that is always rolled back.
 * This keeps each test isolated — no side-effects persist.
 *
 * Usage:
 *   test('something', () => isolated(async (conn) => {
 *     await conn.query('INSERT INTO ...');
 *     const [[row]] = await conn.query('SELECT ...');
 *     expect(row.status).toBe('pending');
 *   }));
 */
async function isolated(fn) {
  if (!pool) throw new Error('Call setup() before isolated()');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await fn(conn);
  } finally {
    try { await conn.rollback(); } catch (_) {}
    conn.release();
  }
}

module.exports = {
  get pool() { return pool; },
  setup,
  teardown,
  isolated,
};
