// modules/auth/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M1 AUTH MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// This file is the ONLY thing other modules are allowed to import from /auth.
// If a caller reaches into modules/auth/routes/* or middleware/* directly,
// that's a boundary violation.
//
// Convention for every module's contract.js:
//   - `middleware` — Express middlewares this module provides
//   - `functions`  — async helpers callable as JS (for other modules' routes)
//   - `routes`     — mount points (for server.js)
//   - `tables`     — which DB tables this module owns (for gate checks)
//   - `version`    — contract semver; bumped on breaking change
// ═══════════════════════════════════════════════════════════════════════════

const authMW = require('./middleware/auth');
const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  // ── MIDDLEWARE (other modules use these to protect their routes) ────────
  middleware: {
    requireAuth:         authMW.requireAuth,
    requireRole:         authMW.requireRole,
    requirePrincipal:    authMW.requirePrincipal,
    requirePMC:          authMW.requirePMC,
    requireDesign:       authMW.requireDesign,
    requireServices:     authMW.requireServices,
    requireProjectScope: authMW.requireProjectScope,
    requireScopeFromEntity: authMW.requireScopeFromEntity,
    blockAuditWrites:    authMW.blockAuditWrites,
  },

  // ── HELPERS (async functions other modules may call) ────────────────────
  functions: {
    /** Resolve a user row by id; returns null if missing or inactive. */
    async getUser(userId) {
      const [rows] = await db.query(
        `SELECT id, username, full_name, role, stream, is_active
         FROM users WHERE id = ?`,
        [userId]
      );
      return rows[0] || null;
    },

    /**
     * Bulk user lookup by array of ids. Returns a Map of id → user row.
     * Callers that need to hydrate N rows with user names should use this
     * instead of N calls to getUser (that would be an N+1 anti-pattern).
     *
     * Includes inactive users too, because historical report rows may reference
     * users who were since deactivated — display name should still render.
     */
    async getUsers(userIds) {
      if (!Array.isArray(userIds) || userIds.length === 0) return new Map();
      const unique = [...new Set(userIds.filter(Boolean))];
      if (unique.length === 0) return new Map();
      const [rows] = await db.query(
        `SELECT id, username, full_name, role, phone, is_active
         FROM users WHERE id IN (?)`,
        [unique]
      );
      return new Map(rows.map(r => [r.id, r]));
    },

    /**
     * PMC heads assigned to a project — used by Reporting to notify PMC of
     * new weekly report events. Single JOIN hides the project_assignments
     * table (owned by Onboarding), but the result is user-shaped so this
     * helper lives in Auth.
     */
    async getPmcHeadsForProject(projectId) {
      if (!projectId) return [];
      const [rows] = await db.query(
        `SELECT u.id, u.phone, u.full_name
         FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id
         WHERE pa.project_id = ? AND u.role = 'pmc_head' AND u.is_active = 1 AND pa.is_active = 1`,
        [projectId]
      );
      return rows;
    },

    /** Find all active users with a given role (optionally scoped to a project).
     *  Returns { id, username, full_name, role, phone } — phone included so
     *  callers that need WhatsApp notification contact info don't need a
     *  second lookup.
     */
    async getUsersByRole(role, projectId = null) {
      if (!projectId) {
        const [rows] = await db.query(
          `SELECT id, username, full_name, role, phone FROM users
           WHERE role = ? AND is_active = 1 ORDER BY full_name`,
          [role]
        );
        return rows;
      }
      const [rows] = await db.query(
        `SELECT u.id, u.username, u.full_name, u.role, u.phone
         FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id AND pa.is_active = 1
         WHERE u.role = ? AND u.is_active = 1 AND pa.project_id = ?
         ORDER BY u.full_name`,
        [role, projectId]
      );
      return rows;
    },

    /** Permission helpers used by drawing + schedule approval flows. */
    canApproveDrawing: authMW.canApproveDrawing,
    canFlagDrawing:    authMW.canFlagDrawing,
    canApproveSchedule: authMW.canApproveSchedule,
  },

  // ── ROUTE MOUNTS (server.js uses these) ─────────────────────────────────
  routes: {
    auth:          require('./routes/auth'),
    users:         require('./routes/users'),
    userManagement: require('./routes/user-management'),
    adminReset:    require('./routes/admin-reset'),
  },

  // ── TABLES OWNED BY THIS MODULE ─────────────────────────────────────────
  // Other modules may READ these but must not write to them.
  tables: [
    'users',
    'user_pending',
  ],
};
