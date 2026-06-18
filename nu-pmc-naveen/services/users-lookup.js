// services/users-lookup.js
// ============================================================
// Common user-lookup queries extracted from 25+ sites across routes.
// All return active users only (is_active = 1).
//
// For "find everyone with role X" — usersByRole(role[, fields])
// For "find users with role X assigned to project P" — usersByRoleOnProject(role, projectId[, fields])
// For "find phones of role X (for WhatsApp)" — phonesByRole(role[, projectId])
//
// ─── DUAL-SUBSTRATE NOTE (Concept-Map Audit, May 2026) ───────────────
// "Who do I send to?" has TWO substrates in nu PMC:
//
//   Path A — notification_triggers DB table (governance-sheet editable).
//            Used by services/notifications.js _notifyByEvent(). This is
//            the CORRECT substrate when the question is "who gets notified
//            for event X?" Naveen edits Sheet 3, reloads, behavior changes
//            without code edits.
//
//   Path B — THIS FILE's helpers (principals, pmcHeads, financeAdmins,
//            streamHeads, principalPhones). Hardcoded role lists in code.
//            CORRECT when the question is "I need a list of users with
//            role X for some non-notification purpose" — e.g. populating
//            an assignment dropdown, listing approvers in a UI, computing
//            'who can act on this'.
//
// COMMON DRIFT: a route does
//   const principals = await users.principals();
//   for (const p of principals) await notifyWhatsApp(p.id, msg);
// That hardcodes the recipient role for a notification, bypassing the
// governance-sheet routing in notification_triggers. If Naveen edits the
// sheet to add or remove a recipient role, the route ignores the edit.
//
// CORRECT shape for notifications:
//   await notifications.notifyXxx(...)        // calls _notifyByEvent internally
// or, for events that don't have a notifyXxx helper yet, add one in
// services/notifications.js that calls _notifyByEvent('event_key', fallback, …).
//
// 22 known drift sites as of May 2026; pinned in tests/recipient-lookup-lint.test.js
// allowlist. Migration of each is blocked on Naveen seeding the right rows
// in notification_triggers (governance-sheet decision). New code that adds
// to the drift list will fail the lint guard.
// ─────────────────────────────────────────────────────────────────────
// ============================================================

const db = require('../middleware/db');

// Default field set when caller doesn't specify
const DEFAULT_FIELDS = 'id';
const CONTACT_FIELDS = 'id, phone, full_name';

// Whitelist of users-table columns that may be SELECTed via the `fields`
// parameter. Column names cannot be parameterised with `?`, so without this
// guard a caller could pass e.g. "id; DROP TABLE users --" and have it
// interpolated raw. Today no callsite passes user input, but the API surface
// allowed it. B14 in the audit.
const _ALLOWED_FIELDS = new Set([
  'id', 'phone', 'full_name', 'email',
  'role', 'deputy_for_user_id', 'is_active',
  'whatsapp_notifications', 'matrix_user_id',
  'created_at', 'last_login_at',
]);
function _safeFields(fields) {
  const cols = String(fields).split(',').map(s => s.trim());
  for (const c of cols) {
    if (!_ALLOWED_FIELDS.has(c)) {
      throw new Error(`users-lookup: column '${c}' not in allowlist`);
    }
  }
  return cols.join(', ');
}

function _normRoles(role) {
  return Array.isArray(role) ? role : [role];
}

/**
 * usersByRole(role, [fields])
 *   role   — string or array of strings
 *   fields — SQL column list (default: 'id'); use CONTACT_FIELDS for notifications
 * Returns: array of rows
 */
async function usersByRole(role, fields = DEFAULT_FIELDS) {
  const safeFields = _safeFields(fields);
  const roles = _normRoles(role);
  const placeholders = roles.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT ${safeFields} FROM users WHERE role IN (${placeholders}) AND is_active = 1`,
    roles
  );
  return rows;
}

/**
 * usersByRoleOnProject(role, projectId, [fields])
 *   Only returns users who are currently assigned (and active) to the given project.
 */
async function usersByRoleOnProject(role, projectId, fields = DEFAULT_FIELDS) {
  const safeFields = _safeFields(fields);
  const roles = _normRoles(role);
  const placeholders = roles.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT DISTINCT ${safeFields.split(',').map(f => 'u.' + f.trim()).join(', ')}
     FROM users u
     JOIN project_assignments pa ON pa.user_id = u.id
     WHERE u.role IN (${placeholders}) AND u.is_active = 1
       AND pa.project_id = ? AND pa.is_active = 1`,
    [...roles, projectId]
  );
  return rows;
}

/**
 * phonesByRole(role, [projectId])
 *   Returns rows with { id, phone, full_name } — only those with a phone set.
 *   If projectId given, filters to assignment; else global.
 */
async function phonesByRole(role, projectId = null) {
  const roles = _normRoles(role);
  const placeholders = roles.map(() => '?').join(',');
  if (projectId) {
    const [rows] = await db.query(
      `SELECT DISTINCT u.id, u.phone, u.full_name
       FROM users u
       JOIN project_assignments pa ON pa.user_id = u.id
       WHERE u.role IN (${placeholders}) AND u.is_active = 1 AND u.phone IS NOT NULL
         AND pa.project_id = ? AND pa.is_active = 1`,
      [...roles, projectId]
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT id, phone, full_name FROM users
     WHERE role IN (${placeholders}) AND is_active = 1 AND phone IS NOT NULL`,
    roles
  );
  return rows;
}

// Shortcut helpers for the most-used combinations — makes call sites read better
const principals             = (fields)       => usersByRole(['principal','design_principal'], fields || DEFAULT_FIELDS);
const principalPhones        = ()             => phonesByRole(['principal','design_principal']);
const pmcHeads               = (fields)       => usersByRole('pmc_head', fields || DEFAULT_FIELDS);
const financeAdmins          = (fields)       => usersByRole('finance_admin', fields || DEFAULT_FIELDS);
const streamHeads            = (fields)       => usersByRole(['design_head','services_head'], fields || DEFAULT_FIELDS);

/**
 * F8: userContact(id) → { id, phone, full_name, whatsapp_notifications } or null
 * Replaces 5+ scattered variants of SELECT phone/name FROM users WHERE id = ?.
 */
async function userContact(userId) {
  if (!userId) return null;
  const [[row]] = await db.query(
    'SELECT id, phone, full_name, whatsapp_notifications, matrix_room_id FROM users WHERE id = ? AND is_active = 1',
    [userId]
  );
  return row || null;
}

/**
 * F7: projectName(id) → string (project name) or null
 * Replaces 10+ scattered `SELECT name FROM projects WHERE id = ?` calls.
 * Used mostly for WhatsApp message formatting.
 */
async function projectName(projectId) {
  if (!projectId) return null;
  const [[row]] = await db.query(
    'SELECT name FROM projects WHERE id = ?',
    [projectId]
  );
  return row?.name || null;
}

module.exports = {
  usersByRole,
  usersByRoleOnProject,
  phonesByRole,
  principals,
  principalPhones,
  pmcHeads,
  financeAdmins,
  streamHeads,
  userContact,
  projectName,
  CONTACT_FIELDS,
};
