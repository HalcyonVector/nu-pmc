// middleware/db.js — MySQL connection pool
const mysql = require('mysql2/promise');

const poolConfig = {
  host:            process.env.DB_HOST     || 'localhost',
  port:            parseInt(process.env.DB_PORT) || 3306,
  database:        process.env.DB_NAME     || 'nu_pmc',
  user:            process.env.DB_USER     || 'nu_app',
  password:        process.env.DB_PASSWORD || process.env.DB_PASS || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit:      50,  // buffer under traffic spikes; 0 = unlimited (risky)
  charset:         'utf8mb4',
  timezone:        '+05:30',  // IST
};
// Support Unix socket for local testing/production
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
}
const pool = mysql.createPool(poolConfig);

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✓ Database connected');
    conn.release();
  })
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  });

/**
 * Transaction helper — wraps a callback in a BEGIN/COMMIT/ROLLBACK block.
 * Usage:
 *   const result = await tx(async (conn) => {
 *     await conn.query('INSERT ...');
 *     await conn.query('UPDATE ...');
 *     return someValue;
 *   });
 * If the callback throws, the transaction is rolled back and the error re-thrown.
 */
async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_e) { /* rollback best-effort */ }
    throw err;
  } finally {
    conn.release();
  }
}

pool.tx = tx;
module.exports = pool;
