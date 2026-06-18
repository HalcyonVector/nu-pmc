// routes/comms.js — Client Communication Log
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { makeValidator } = require('../../../middleware/validate');
const asyncHandler = require('../../../middleware/asyncHandler');
const { PMC_ROLES, CLIENT_RATE_ROLES: RATE_ROLES } = require('../../../services/roles');
const router  = express.Router();

const validateComm = makeValidator({
  document_type: { required: true, enum: ['measurement_certificate','mom','weekly_report',
                                           'drawing','snag_update','ncr_update',
                                           'change_notice','invoice','other'] },
  method: { required: true, enum: ['whatsapp','email','hard_copy','courier','in_person_handover'] },
  document_ref:  { required: false, type: 'string', maxLength: 100 },
});

// GET /api/comms/:project_id — full communication log
router.get('/:project_id', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    // Audit reads everything on GET — matches isAuditGet() carve-out in
    // middleware/auth.js. RATE_ROLES enforces the client-rate-visibility
    // cohort for all other roles.
    if (me.role !== 'audit' && !RATE_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const [comms] = await db.query(
      `SELECT * FROM client_comms
       WHERE project_id = ?
       ORDER BY comm_date DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(comms.map(c => c.sent_by).filter(Boolean));
    comms.forEach(c => { c.sent_by_name = users.get(c.sent_by)?.full_name || null; });

    // Summary stats
    const [[stats]] = await db.query(
      `SELECT
         COUNT(*) AS total_sent,
         SUM(client_ack_at IS NOT NULL) AS acknowledged,
         MAX(comm_date) AS last_comm_date
       FROM client_comms WHERE project_id = ?`,
      [req.params.project_id]
    );

    res.json({ comms, stats });
  }));

// POST /api/comms/:project_id — manual entry
router.post('/:project_id', requireAuth, requireProjectScope(), requireRole(...PMC_ROLES), validateComm, asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const { document_type, document_ref, method, notes,
            comm_date, document_path } = req.body;

    const [result] = await db.query(
      `INSERT INTO client_comms
         (project_id, comm_date, document_type, document_ref,
          document_path, sent_by, method, notes, auto_logged)
       VALUES (?,?,?,?,?,?,?,?,0)`,
      [req.params.project_id,
       comm_date || new Date().toISOString(),
       document_type, document_ref || null,
       document_path || null, me.id, method, notes || null]
    );

    res.json({ success: true, id: result.insertId });
  }));

// PATCH /api/comms/:project_id/:id/ack — record client acknowledgement
router.patch('/:project_id/:id/ack', requireAuth, requireProjectScope(), requireRole(...PMC_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { client_response } = req.body;

    await db.query(
      `UPDATE client_comms SET
         client_ack_at = NOW(),
         client_response = ?
       WHERE id = ? AND project_id = ?`,
      [client_response || null, req.params.id, req.params.project_id]
    );

    res.json({ success: true, message: 'Client acknowledgement recorded' });
  }));

module.exports = router;
