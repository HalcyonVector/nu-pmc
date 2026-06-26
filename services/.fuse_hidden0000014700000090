// services/audit.js
// ============================================================
// F20: Structured audit logging to the `audit_log` table.
//
// Routes/services call `audit.log({...})` to record any
// auditable event. State machines call this automatically on
// every successful transition when an `audit` context is passed
// to `transition()`.
//
// The `audit_log` table stores:
//   user_id, action, entity_type, entity_id, details (JSON),
//   ip_address, user_agent, created_at.
//
// The helper swallows its own errors (logs + returns) — audit
// failures must never break business flows.
// ============================================================

const db = require('../middleware/db');

/**
 * Record a single audit event.
 *
 * @param {object}  opts
 * @param {number?} opts.userId       — actor (null for system actions)
 * @param {string}  opts.action       — short verb/noun tag, e.g.
 *                                      'payment_request.transition',
 *                                      'client_boq.hsn_update'
 * @param {string?} opts.entityType   — table/logical entity name
 * @param {number?} opts.entityId     — id of that row
 * @param {object?} opts.details      — JSON payload (from/to, reason, etc.)
 * @param {object?} opts.req          — Express req (for ip + user-agent)
 */
async function log({ userId = null, action, entityType = null, entityId = null, details = null, req = null } = {}) {
  if (!action) return; // action is the only required field
  try {
    const ip = req
      ? (req.headers?.['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || null)
      : null;
    const ua = req?.headers?.['user-agent'] || null;
    await db.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?,?,?,?,?,?,?)`,
      [
        userId,
        String(action).slice(0, 50),
        entityType ? String(entityType).slice(0, 40) : null,
        entityId ?? null,
        details ? JSON.stringify(details) : null,
        ip ? String(ip).slice(0, 45) : null,
        ua ? String(ua).slice(0, 500) : null,
      ]
    );
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

module.exports = { log };
