// services/sequence.js
// ============================================================
// Project-scoped sequential number generator with built-in retry.
// Background: tables like issues.issue_number and meetings.meeting_number
// use a "read last, increment, insert" pattern which races under
// concurrent requests. The UNIQUE constraints added in v3 guard data
// integrity; this helper lets callers recover gracefully.
//
// Usage:
//   const { generate } = require('./services/sequence');
//   const issueNumber = await generate({
//     table:     'issues',
//     numberCol: 'issue_number',
//     projectId: req.params.project_id,
//     prefix:    'ISS-',
//     pad:       3,
//     where:     '',                   // extra WHERE clause (e.g. "AND issue_type='quality'")
//   });
//   // then INSERT with issueNumber. If UNIQUE fails, regenerate.
// ============================================================

const db = require('../middleware/db');

async function generate({ table, numberCol, projectId, prefix, pad = 3, where = '' }) {
  const sql = `SELECT ${numberCol} FROM ${table} WHERE project_id=? ${where} ORDER BY id DESC LIMIT 1`;
  const [[last]] = await db.query(sql, [projectId]);
  // Extract trailing digit sequence regardless of separator.
  // Handles 'GRN-001' (hyphen), 'SN001' (run-together), 'PI/WESCH/2026/001' (slashes).
  const lastStr = String(last?.[numberCol] || '');
  const match   = lastStr.match(/(\d+)$/);
  const currentNum = match ? parseInt(match[1], 10) : 0;
  const nextNum = currentNum + 1;
  return prefix + String(nextNum).padStart(pad, '0');
}

/**
 * generateInt — integer-only version sequence for tables like schedule_versions
 * where `version_number` is a plain integer (1, 2, 3...) with no prefix.
 *
 * @param {Object} opts
 * @param {string} opts.table — table name
 * @param {string} opts.numberCol — integer column, e.g. 'version_number'
 * @param {number} [opts.projectId] — project scope (default scopeCol = 'project_id')
 * @param {string} [opts.scopeCol] — override scope column, e.g. 'drawing_id'
 * @param {*} [opts.scopeVal] — override scope value; use with scopeCol
 * @param {string} [opts.where] — optional extra WHERE clause (e.g. "AND stream='design'")
 */
async function generateInt({ table, numberCol, projectId = null, scopeCol = 'project_id', scopeVal = null, where = '' }) {
  const val = scopeVal !== null ? scopeVal : projectId;
  const sql = `SELECT ${numberCol} AS val FROM ${table} WHERE ${scopeCol}=? ${where} ORDER BY id DESC LIMIT 1`;
  const [[last]] = await db.query(sql, [val]);
  return (parseInt(last?.val || 0, 10) || 0) + 1;
}

/**
 * insertWithRetry(insertFn) — runs insertFn up to `attempts` times,
 * retrying on ER_DUP_ENTRY. insertFn receives no arguments and must
 * regenerate the number inside the callback each iteration.
 */
async function insertWithRetry(insertFn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await insertFn();
    } catch (err) {
      if (err?.code !== 'ER_DUP_ENTRY') throw err;
      lastErr = err;
      // tiny back-off to let the winning transaction finish
      await new Promise(r => setTimeout(r, 15 + Math.random() * 35));
    }
  }
  throw lastErr;
}

module.exports = { generate, generateInt, insertWithRetry };
