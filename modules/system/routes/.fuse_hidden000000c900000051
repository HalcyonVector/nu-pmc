// routes/pmc-assignments.js — per-project PMC assignment management (v4.3)
//
// Endpoints:
//   GET  /api/pmc-assignments/:project_id        — current primary + backup
//   POST /api/pmc-assignments/:project_id        — assign/swap primary or backup
//         body: { user_id, kind, effective_from, note }
//         Server handles effective_to closure on the outgoing row automatically.
//   GET  /api/pmc-assignments/:project_id/history — audit trail of swaps
//   DELETE /api/pmc-assignments/:project_id/:kind — remove (close out effective_to)
//
// Who can write: principal, design_principal only (this is a supervisory assignment).
// Who can read: all project members + audit.

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireRole } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router = express.Router();

const READER_ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'finance_admin','senior_site_manager','site_manager','team_lead',
  'jr_architect','services_engineer','coordinator','audit'
];

// ── GET /:project_id ─ current primary + backup with user details ─────────
router.get('/:project_id',
  requireAuth,
  requireRole(...READER_ROLES),
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });

    const [[row]] = await db.query(
      `SELECT
         project_id, project_code,
         primary_pmc_id, backup_pmc_id,
         primary_assignment_id, backup_assignment_id,
         (SELECT effective_from FROM project_pmc_assignments WHERE id=current_pmc_assignments.primary_assignment_id) AS primary_since,
         (SELECT effective_from FROM project_pmc_assignments WHERE id=current_pmc_assignments.backup_assignment_id)  AS backup_since
       FROM current_pmc_assignments
       WHERE project_id = ?`,
      [projectId]
    );
    if (row) {
      const Auth = require('../../auth/contract');
      const users = await Auth.functions.getUsers([row.primary_pmc_id, row.backup_pmc_id].filter(Boolean));
      row.primary_name  = users.get(row.primary_pmc_id)?.full_name || null;
      row.primary_phone = users.get(row.primary_pmc_id)?.phone     || null;
      row.backup_name   = users.get(row.backup_pmc_id)?.full_name  || null;
      row.backup_phone  = users.get(row.backup_pmc_id)?.phone      || null;
    }
    res.json({ assignment: row || null });
  })
);

// ── POST /:project_id ─ assign primary or backup, closing out the outgoing ─
// Transaction semantics:
//   1. Close the active row for (project, kind) by setting its effective_to.
//   2. Insert a new row with the new user_id.
// Both steps in one TX. If step 2 fails (e.g. user doesn't exist), step 1 is
// rolled back and the old assignment stands.
router.post('/:project_id',
  requireAuth,
  requireRole('principal','design_principal'),
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });

    const { user_id, kind, effective_from, note } = req.body || {};
    if (!user_id || !['primary','backup'].includes(kind) || !effective_from) {
      return res.status(400).json({ error: 'user_id, kind (primary|backup), and effective_from required' });
    }

    // Validate assignee exists and is a pmc_head
    const [[assignee]] = await db.query(
      `SELECT id, role FROM users WHERE id = ? AND is_active = 1`, [user_id]
    );
    if (!assignee) return res.status(400).json({ error: 'Assignee user not found or inactive' });
    if (assignee.role !== 'pmc_head') {
      return res.status(400).json({ error: 'Only pmc_head users can be assigned as project PMC' });
    }

    // Start transaction
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // If the new primary is currently occupying the backup slot, close the
      // backup row. Avoids the "same user listed twice" state that happens when
      // promoting backup → primary during leave cover or departure workflows.
      // Only applies when assigning primary; backup assignment is untouched.
      let autoClearedBackup = false;
      if (kind === 'primary') {
        const [result] = await conn.query(
          `UPDATE project_pmc_assignments
             SET effective_to = ?
           WHERE project_id = ? AND kind = 'backup' AND effective_to IS NULL
             AND user_id = ?`,
          [
            new Date(new Date(effective_from).getTime() - 86400000)
              .toISOString().slice(0, 10),
            projectId, user_id
          ]
        );
        autoClearedBackup = result.affectedRows > 0;
      }

      // Close out any currently-active row for (project, kind). The day before
      // effective_from is used so effective periods don't overlap.
      const effFrom = new Date(effective_from);
      const effPrevious = new Date(effFrom.getTime() - 86400000);
      const effToStr = effPrevious.toISOString().slice(0, 10);
      await conn.query(
        `UPDATE project_pmc_assignments
           SET effective_to = ?
         WHERE project_id = ? AND kind = ? AND effective_to IS NULL`,
        [effToStr, projectId, kind]
      );

      // Insert new row
      const [ins] = await conn.query(
        `INSERT INTO project_pmc_assignments
           (project_id, user_id, kind, effective_from, assigned_by, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, user_id, kind, effective_from, req.session.user.id, note || null]
      );

      await conn.commit();
      audit.log({ userId: req.session.user.id,
        action: autoClearedBackup ? 'pmc_assignment.swap_with_backup_clear' : 'pmc_assignment.set',
        entityType: 'project_pmc_assignments', entityId: ins.insertId,
        details: { project_id: projectId, user_id, kind, effective_from,
                   auto_cleared_backup: autoClearedBackup, note: note || null }, req });
      res.json({
        success: true,
        assignment_id: ins.insertId,
        auto_cleared_backup: autoClearedBackup,
        message: autoClearedBackup
          ? 'Primary assigned. Backup slot was auto-cleared (the new primary was the previous backup).'
          : undefined,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// ── GET /:project_id/history — audit trail of PMC swaps ───────────────────
router.get('/:project_id/history',
  requireAuth,
  requireRole(...READER_ROLES),
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.project_id, 10);
    const [rows] = await db.query(
      `SELECT id, kind, effective_from, effective_to, assigned_at, note,
              user_id, assigned_by
       FROM project_pmc_assignments
       WHERE project_id = ?
       ORDER BY effective_from DESC, id DESC`,
      [projectId]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(rows.flatMap(r => [r.user_id, r.assigned_by].filter(Boolean)));
    rows.forEach(r => {
      const u = users.get(r.user_id);
      r.user_name = u?.full_name || null;
      r.user_login = u?.username || null;
      r.assigned_by_name = users.get(r.assigned_by)?.full_name || null;
    });
    res.json({ history: rows });
  })
);

// ── DELETE /:project_id/:kind — remove assignment (mark effective_to=today) ─
router.delete('/:project_id/:kind',
  requireAuth,
  requireRole('principal','design_principal'),
  asyncHandler(async (req, res) => {
    const projectId = parseInt(req.params.project_id, 10);
    const kind = req.params.kind;
    if (!['primary','backup'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be primary or backup' });
    }
    const today = new Date().toISOString().slice(0, 10);
    const [result] = await db.query(
      `UPDATE project_pmc_assignments
         SET effective_to = ?
       WHERE project_id = ? AND kind = ? AND effective_to IS NULL`,
      [today, projectId, kind]
    );
    audit.log({ userId: req.session.user.id, action: 'pmc_assignment.remove',
      entityType: 'project_pmc_assignments', entityId: null,
      details: { project_id: projectId, kind, effective_to: today,
                 affected_rows: result.affectedRows }, req });
    res.json({ success: true, affected: result.affectedRows });
  })
);

module.exports = router;
