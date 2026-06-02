// services/external-comm.js
// ============================================================
// External communication assignment system.
//
// When a vendor (or external party) is not on Matrix, this service
// creates an assignment row for the responsible internal person to
// send the message manually via a wa.me deep link.
//
// One public function: assignExternalComm().
// Everything else (role resolution, wa.me link, due_at) is internal.
//
// The friction is intentional: repeated manual sends create pressure
// to onboard vendors to Matrix.
// ============================================================

'use strict';

const db      = require('../middleware/db');
const { buildWaMe } = require('./wa-link');
const matrixAdapter = require('./matrix-adapter');

/**
 * Assign a pending external communication to the responsible person.
 *
 * Looks up external_comm_config for the activity type, resolves the
 * active person in that role for the project (or org-wide), generates
 * the wa.me link, inserts the assignment row, and sends a Matrix
 * notification to the assigned person's personal room.
 *
 * @param {object} opts
 * @param {string} opts.activityType   — matches external_comm_config.activity_type
 * @param {number} [opts.vendorId]     — vendor being contacted
 * @param {number} [opts.documentId]   — document triggering this communication
 * @param {string} [opts.documentTable]
 * @param {number} [opts.projectId]    — null for org-wide activities
 * @param {string} opts.vendorPhone    — phone number for the wa.me link
 * @param {string} opts.messageBody    — pre-composed message body
 * @returns {Promise<{assignmentId: number, assignedTo: object}|null>}
 */
async function assignExternalComm({
  activityType,
  vendorId       = null,
  documentId     = null,
  documentTable  = null,
  projectId      = null,
  vendorPhone,
  messageBody,
}) {
  if (!activityType) throw new Error('assignExternalComm: activityType required');
  if (!vendorPhone)  throw new Error('assignExternalComm: vendorPhone required');
  if (!messageBody)  throw new Error('assignExternalComm: messageBody required');

  // Look up config: which role is responsible for this activity type?
  const [[config]] = await db.query(
    `SELECT responsible_role, due_hours, label
       FROM external_comm_config
      WHERE activity_type = ? AND active = 1
      LIMIT 1`,
    [activityType]
  );
  if (!config) {
    console.warn(`[external-comm] No config found for activityType: ${activityType}`);
    return null;
  }

  // Resolve the active person in that role for the project (or org-wide).
  const assignedTo = await _resolveResponsible(config.responsible_role, projectId);
  if (!assignedTo) {
    console.warn(`[external-comm] No active user found for role: ${config.responsible_role} project: ${projectId}`);
    return null;
  }

  // Build the wa.me link.
  const waLink = buildWaMe({ phone: vendorPhone, body: messageBody });
  if (!waLink) {
    console.warn(`[external-comm] Could not build wa.me link for phone: ${vendorPhone}`);
    return null;
  }

  // Compute due_at from config.due_hours.
  const dueAt = new Date(Date.now() + config.due_hours * 60 * 60 * 1000);

  // Insert assignment row.
  const [result] = await db.query(
    `INSERT INTO external_comm_assignments
       (activity_type, vendor_id, document_id, document_table,
        wa_me_link, message_body, assigned_to, project_id, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [activityType, vendorId, documentId, documentTable,
     waLink, messageBody, assignedTo.id, projectId, dueAt]
  );
  const assignmentId = result.insertId;

  // Notify the assigned person via Matrix DM (non-blocking).
  if (assignedTo.matrix_room_id) {
    const pwaUrl = `${process.env.PWA_BASE_URL}/external-comms/${assignmentId}`;
    matrixAdapter.sendText({
      roomId: assignedTo.matrix_room_id,
      body:   `📱 Action needed — ${config.label}. Open queue to send: ${pwaUrl}`,
      recipientUid: assignedTo.id,
    }).catch(e => console.warn('[external-comm] Matrix notify failed:', e.message));
  }

  return { assignmentId, assignedTo };
}

/**
 * Resolve the active person in a role for a given project.
 * For project-scoped roles (pmc_head, site_manager): look in project_assignments.
 * For org-wide roles (finance_admin, principal): look in users directly.
 */
async function _resolveResponsible(role, projectId) {
  const PROJECT_ROLES = ['pmc_head', 'site_manager', 'senior_site_manager'];

  if (projectId && PROJECT_ROLES.includes(role)) {
    const [[user]] = await db.query(
      `SELECT u.id, u.full_name, u.matrix_room_id,
              COUNT(eca.id) AS pending_count
         FROM users u
         JOIN project_assignments pa ON pa.user_id = u.id
         LEFT JOIN external_comm_assignments eca
           ON eca.assigned_to = u.id AND eca.status = 'pending'
        WHERE pa.project_id = ?
          AND u.role = ?
          AND u.is_active = 1
          AND pa.is_active = 1
        GROUP BY u.id
        ORDER BY pending_count ASC
        LIMIT 1`,
      [projectId, role]
    );
    return user || null;
  }

  // Org-wide role — pick the active user with fewest pending assignments.
  const [[user]] = await db.query(
    `SELECT u.id, u.full_name, u.matrix_room_id,
            COUNT(eca.id) AS pending_count
       FROM users u
       LEFT JOIN external_comm_assignments eca
         ON eca.assigned_to = u.id AND eca.status = 'pending'
      WHERE u.role = ? AND u.is_active = 1
      GROUP BY u.id
      ORDER BY pending_count ASC
      LIMIT 1`,
    [role]
  );
  return user || null;
}

module.exports = { assignExternalComm };
