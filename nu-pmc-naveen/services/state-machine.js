// services/state-machine.js
// ============================================================
// Tiny state-machine factory. ~30 lines of actual logic.
//
// Usage:
//   const sm = createStateMachine({
//     name: 'payment_request',
//     table: 'payment_requests',
//     transitions: {
//       pending_pmc:    ['pmc_approved','pending_principal','pmc_rejected'],
//       pmc_approved:   ['principal_approved','paid'],
//       pending_principal: ['principal_approved','principal_rejected'],
//       principal_approved:['paid'],
//       // terminal: pmc_rejected, principal_rejected, paid
//     },
//     terminal: ['pmc_rejected','principal_rejected','paid'],
//   });
//
// Then in a route:
//   await sm.transition({ id, from: row.status, to: 'pmc_approved',
//     extraCols: { pmc_reviewed_by: me.id, pmc_reviewed_at: new Date() } });
//
// If `from` doesn't match the row's current status, the call FAILS
// (prevents double-transitions from two concurrent clicks).
// If `to` isn't a valid target of `from`, the call THROWS with a
// predictable error — routes can catch it and return 400.
// ============================================================

const db = require('../middleware/db');

class StateTransitionError extends Error {
  constructor(msg, { machine, from, to, id } = {}) {
    super(msg);
    this.name = 'StateTransitionError';
    this.code = 'INVALID_STATE_TRANSITION';
    this.status = 400;  // central errorHandler renders as 400 instead of 500
    this.machine = machine;
    this.from = from;
    this.to = to;
    this.id = id;
  }
}

function createStateMachine({ name, table, transitions, terminal = [], statusColumn = 'status' }) {
  if (!name || !table || !transitions) {
    throw new Error('createStateMachine: name, table, transitions required');
  }
  const allStates = new Set([...Object.keys(transitions), ...Object.values(transitions).flat(), ...terminal]);

  function canTransition(from, to) {
    return (transitions[from] || []).includes(to);
  }

  function isTerminal(state) {
    return terminal.includes(state) || !(transitions[state] && transitions[state].length);
  }

  /**
   * Move a row from `from` state to `to` state.
   *   - Fails if `from` doesn't match the current DB state (concurrency guard)
   *   - Throws StateTransitionError if the transition isn't allowed
   *   - Updates the status column + any extraCols atomically
   *   - If `audit` is provided (shape: { userId, req, details? }),
   *     a row is written to `audit_log` AFTER a successful transition.
   *     The audit write cannot fail the transition (errors are swallowed
   *     inside services/audit.js).
   * Returns: { changed: true } on success.
   */
  async function transition({ id, from, to, extraCols = {}, audit = null, conn = null }) {
    if (!allStates.has(to)) {
      throw new StateTransitionError(`${name}: "${to}" is not a known state`, { machine: name, from, to, id });
    }
    if (!canTransition(from, to)) {
      throw new StateTransitionError(
        `${name}: cannot go from "${from}" to "${to}". Allowed: ${(transitions[from]||[]).join(', ') || '(terminal)'}`,
        { machine: name, from, to, id }
      );
    }
    // Build the UPDATE with extra columns
    const cols = [statusColumn, ...Object.keys(extraCols)];
    const vals = [to,           ...Object.values(extraCols)];
    const setFrag = cols.map(c => `${c} = ?`).join(', ');
    // Use the caller's transaction connection if provided (so the status update
    // commits/rolls-back atomically with surrounding writes); otherwise use the
    // shared pool. WHERE id=? AND <statusCol>=from is the concurrency guard.
    const exec = conn || db;
    const [result] = await exec.query(
      `UPDATE ${table} SET ${setFrag} WHERE id = ? AND ${statusColumn} = ?`,
      [...vals, id, from]
    );
    if (result.affectedRows === 0) {
      throw new StateTransitionError(
        `${name}: row ${id} was not in state "${from}" (may have been transitioned by another request)`,
        { machine: name, from, to, id }
      );
    }
    if (audit) {
      // Lazy require — keeps state-machine.js free of audit dependency at load time
      const a = require('./audit');
      await a.log({
        userId:     audit.userId ?? null,
        action:     `${name}.transition`,
        entityType: name,
        entityId:   id,
        details:    { from, to, ...(audit.details || {}) },
        req:        audit.req || null,
      });
    }
    return { changed: true };
  }

  /**
   * Transition multiple rows in a single bulk UPDATE. Used when an operation
   * (e.g. ICICI batch generation) moves many rows of the same type at once.
   *   - All rows must be in `from` state — the WHERE clause includes status=from
   *     so any row not in that state is silently skipped
   *   - Returns { affected: N } so callers can detect partial application
   *   - Validates the transition once (from→to), since all rows share the edge
   *
   * @param {object}    opts
   * @param {number[]}  opts.ids
   * @param {string}    opts.from
   * @param {string}    opts.to
   * @param {object}    [opts.extraCols]
   * @param {object}    [opts.conn] transaction connection
   */
  async function transitionMany({ ids, from, to, extraCols = {}, conn = null }) {
    if (!Array.isArray(ids) || ids.length === 0) return { affected: 0 };
    if (!allStates.has(to)) {
      throw new StateTransitionError(`${name}: "${to}" is not a known state`, { machine: name, from, to });
    }
    if (!canTransition(from, to)) {
      throw new StateTransitionError(
        `${name}: cannot go from "${from}" to "${to}". Allowed: ${(transitions[from]||[]).join(', ') || '(terminal)'}`,
        { machine: name, from, to }
      );
    }
    const cols = [statusColumn, ...Object.keys(extraCols)];
    const vals = [to,           ...Object.values(extraCols)];
    const setFrag = cols.map(c => `${c} = ?`).join(', ');
    const placeholders = ids.map(() => '?').join(',');
    const exec = conn || db;
    const [result] = await exec.query(
      `UPDATE ${table} SET ${setFrag} WHERE id IN (${placeholders}) AND ${statusColumn} = ?`,
      [...vals, ...ids, from]
    );
    return { affected: result.affectedRows };
  }

  return {
    name,
    table,
    transitions,
    terminal,
    canTransition,
    isTerminal,
    transition,
    transitionMany,
    // Convenience for routes: turns a StateTransitionError into a 400 response
    handleRouteError(err, res) {
      if (err instanceof StateTransitionError) {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      throw err;
    },
  };
}

module.exports = { createStateMachine, StateTransitionError };
