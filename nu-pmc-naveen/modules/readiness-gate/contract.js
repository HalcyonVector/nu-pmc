// modules/readiness-gate/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M3 READINESS GATE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// This module has NO routes and NO tables of its own. It's a pure-logic
// module — other modules call it to decide "is this project ready to do X?".
//
// Ownership: reads `projects.checklist_*` columns, writes `projects.status`.
// The checklist columns are owned by M2 Onboarding (the module that sets
// them during setup). M3 is a CONSUMER + STATE-TRANSITION authority.
// ═══════════════════════════════════════════════════════════════════════════
const svc = require('./service');

module.exports = {
  version: '1.0.0',

  functions: {
    /** Return { ready, blockers, completed, status } for the project. */
    checkReadiness: svc.checkReadiness,

    /** Throw 409 if not ready, else return the readiness summary. */
    assertReady: svc.assertReady,

    /**
     * Flip status to 'active' if all blockers are clear. Idempotent.
     * Returns the readiness summary (with justActivated flag).
     */
    activateIfReady: svc.activateIfReady,
  },

  // Exposed for tests and for UI to render the full blocker list.
  constants: {
    BLOCKERS: svc.BLOCKERS,
  },

  // This module owns no tables — it only reads M2 Onboarding's data.
  // Writes are limited to projects.status, which is state-transition logic
  // that logically belongs to the gate rather than to M2's setup flow.
  tables: [],
};
