// modules/finance/routes/external-comms.js
// ============================================================
// External communication assignment queue.
//
// GET  /api/external-comms/my-queue  — pending assignments for calling user
// POST /api/external-comms/:id/mark-sent — mark one assignment as sent
// POST /api/external-comms/:id/cancel    — cancel an assignment (manager only)
// ============================================================

'use strict';

const express      = require('express');
const router       = express.Router();
const db           = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const audit        = require('../../../services/audit');
const asyncHandler = require('../../../middleware/asyncHandler');

// ── GET /api/external-comms/my-queue ─────────────────────────────────
// Returns all pending external comm assignments for the calling user.
// Ordered by due_at ascending — most urgent first.

router.get('/my-queue', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.user.id;

  const [rows] = await db.query(
    `SELECT
       eca.id,
       eca.activity_type,
       ecc.label,
       eca.wa_me_link,
       eca.message_body,
       eca.due_at,
       eca.assigned_at,
       eca.status,
       v.vendor_name,
       v.id AS vendor_id,
       eca.document_id,
       eca.document_table,
       eca.project_id,
       p.name AS project_name,
       p.code AS project_code
     FROM external_comm_assignments eca
     JOIN external_comm_config ecc ON ecc.activity_type = eca.activity_type
     LEFT JOIN vendors v ON v.id = eca.vendor_id
     LEFT JOIN projects p ON p.id = eca.project_id
    WHERE eca.assigned_to = ?
      AND eca.status = 'pending'
    ORDER BY eca.due_at ASC`,
    [userId]
  );

  res.json({
    queue: rows,
    count: rows.length,
    overdue: rows.filter(r => new Date(r.due_at) < new Date()).length,
  });
}));

// ── POST /api/external-comms/:id/mark-sent ───────────────────────────
// Records that the assigned person sent the WhatsApp manually.
// Same pattern as formal_communications/mark-sent.

router.post('/:id/mark-sent', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.user.id;
  const id     = parseInt(req.params.id, 10);

  const [[assignment]] = await db.query(
    `SELECT id, assigned_to, activity_type, vendor_id, status
       FROM external_comm_assignments
      WHERE id = ? LIMIT 1`,
    [id]
  );

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (assignment.assigned_to !== userId) {
    return res.status(403).json({ error: 'This assignment belongs to someone else' });
  }
  if (assignment.status !== 'pending') {
    return res.status(400).json({ error: `Assignment is already ${assignment.status}` });
  }

  await db.query(
    `UPDATE external_comm_assignments
        SET status = 'sent', sent_at = NOW(), marked_sent_by = ?
      WHERE id = ? AND status = 'pending'`,
    [userId, id]
  );

  audit.log({
    userId,
    action: 'external_comm.mark_sent',
    entityType: 'external_comm_assignments',
    entityId: id,
    details: { activity_type: assignment.activity_type, vendor_id: assignment.vendor_id },
    req,
  });

  res.json({ success: true, message: 'Marked as sent.' });
}));

// ── POST /api/external-comms/:id/cancel ──────────────────────────────
// Cancel a pending assignment. Restricted to managers and principals.

router.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.user.id;
  const role   = req.session.user.role;
  const id     = parseInt(req.params.id, 10);
  const { reason } = req.body;

  const CANCELLABLE_ROLES = ['principal', 'design_principal', 'pmc_head', 'finance_admin'];
  if (!CANCELLABLE_ROLES.includes(role)) {
    return res.status(403).json({ error: 'Not authorised to cancel assignments' });
  }

  const [[assignment]] = await db.query(
    `SELECT id, status, activity_type FROM external_comm_assignments WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (assignment.status !== 'pending') {
    return res.status(400).json({ error: `Assignment is already ${assignment.status}` });
  }

  await db.query(
    `UPDATE external_comm_assignments
        SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = ?
      WHERE id = ? AND status = 'pending'`,
    [reason || null, id]
  );

  audit.log({
    userId,
    action: 'external_comm.cancel',
    entityType: 'external_comm_assignments',
    entityId: id,
    details: { reason: reason || null },
    req,
  });

  res.json({ success: true });
}));

module.exports = router;
