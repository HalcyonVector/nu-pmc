// middleware/optimistic-lock.js
// Optimistic locking helper for concurrent writes.
//
// Usage in a route:
//   const ol = require('../middleware/optimistic-lock');
//   await ol.checkAndIncrement(db, 'payment_requests', id, req.body.row_version);
//   // If stale, throws 409 automatically via error handler.

class StaleVersionError extends Error {
  constructor(table, id, clientVersion, dbVersion) {
    super(`Stale version for ${table}#${id}: client=${clientVersion}, current=${dbVersion}`);
    this.name = 'StaleVersionError';
    this.status = 409;
    this.code = 'STALE_VERSION';
    this.table = table;
    this.recordId = id;
    this.clientVersion = clientVersion;
    this.dbVersion = dbVersion;
  }
}

/**
 * Check the client's version matches current DB, then bump version.
 * Must run inside a transaction OR be tolerant of races (we use SELECT ... FOR UPDATE internally).
 *
 * @param {object} db — mysql pool or connection
 * @param {string} table — table name
 * @param {number} id
 * @param {number} clientVersion — row_version sent by client
 * @returns {number} new version
 */
async function checkAndIncrement(db, table, id, clientVersion) {
  if (!clientVersion) {
    throw new StaleVersionError(table, id, null, 'missing');
  }
  const [[row]] = await db.query(
    `SELECT row_version FROM ${table} WHERE id = ?`, [id]
  );
  if (!row) {
    throw new StaleVersionError(table, id, clientVersion, 'not_found');
  }
  if (parseInt(clientVersion) !== parseInt(row.row_version)) {
    throw new StaleVersionError(table, id, clientVersion, row.row_version);
  }
  await db.query(
    `UPDATE ${table} SET row_version = row_version + 1 WHERE id = ? AND row_version = ?`,
    [id, clientVersion]
  );
  return parseInt(clientVersion) + 1;
}

/**
 * Express error handler — converts StaleVersionError to 409 response.
 */
function errorHandler(err, req, res, next) {
  if (err && (err.name === 'StaleVersionError' || err instanceof StaleVersionError)) {
    return res.status(409).json({
      error: 'Stale version — record was modified by another user. Please refresh and try again.',
      code: err.code,
      table: err.table,
      record_id: err.recordId,
      current_version: err.dbVersion,
    });
  }
  next(err);
}

module.exports = { checkAndIncrement, StaleVersionError, errorHandler };
