// routes/user-management.js — Two-step user creation, pending approvals
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const notif   = require('../../../services/notifications');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// Role → who can initiate
const INITIATOR_MAP = {
  team_lead:   ['design_head','principal','design_principal'],
  team_lead:        ['design_head','principal','design_principal'],
  jr_architect:     ['design_head','principal','design_principal'],
  jr_engineer:        ['design_head','principal','design_principal'],
  services_engineer:['services_head','principal','design_principal'],
  site_manager:         ['pmc_head','principal','design_principal'],
  senior_site_manager:  ['pmc_head','principal','design_principal'],
  pmc_head:         ['principal','design_principal'],
  design_head:      ['principal','design_principal'],
  services_head:    ['principal','design_principal'],
};

// GET /api/user-management/pending
router.get('/pending', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canRead = ['principal','design_principal','audit'].includes(me.role);
    if (!canRead) return res.status(403).json({ error: 'Principals and audit only' });
    const [pending] = await db.query(
      `SELECT up.*, u.full_name AS initiated_by_name
       FROM user_pending up
       JOIN users u ON up.initiated_by = u.id
       WHERE up.status = 'pending' ORDER BY up.initiated_at`,
    );
    res.json({ pending });
  }));

// POST /api/user-management/initiate — team head initiates new user
router.post('/initiate', requireAuth, async (req, res) => {
  try {
    const me = req.session.user;
    const { UserInitiate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(UserInitiate, req, res);
    if (!body) return;
    const { username, full_name, phone, role, stream } = body;

    // Check initiator is allowed to add this role
    const allowedInitiators = INITIATOR_MAP[role] || ['principal','design_principal'];
    if (!allowedInitiators.includes(me.role)) {
      return res.status(403).json({ error: `Your role cannot initiate a ${role} user` });
    }

    const [r] = await db.query(
      'INSERT INTO user_pending (username, full_name, phone, role, stream, initiated_by) VALUES (?,?,?,?,?,?)',
      [username.toLowerCase(), full_name, phone||null, role, stream||'all', me.id]
    );

    const audit = require('../../../services/audit');
    audit.log({ userId: me.id, action: 'user.initiate',
      entityType: 'user_pending', entityId: r.insertId,
      details: { username: username.toLowerCase(), full_name, role, stream: stream || 'all' }, req });

    // Notify Principal and Design Principal via event-based routing.
    await notif.notifyNewUserPendingApproval(full_name, role, me.full_name);

    res.json({ success: true, message: `${full_name} pending approval from Principal/Design Principal.` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Failed to initiate user' });
  }
});

// POST /api/user-management/:id/approve — Principal/Design Principal approves
router.post('/:id/approve', requireAuth, requirePrincipal, async (req, res) => {
  try {
    const [[pending]] = await db.query('SELECT * FROM user_pending WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!pending) return res.status(404).json({ error: 'Pending user not found' });

    // Random temp password — user forced to change on first login.
    // Sent to the user via WhatsApp below; never stored in plaintext server-side beyond this call.
    // crypto.randomBytes — Math.random is predictable; an attacker who knows
    // the approval time (visible in user_pending.reviewed_at) could narrow the
    // candidate set to a brute-forceable size.
    const tempPassword = 'tmp-' + crypto.randomBytes(6).toString('hex');
    const hash = await bcrypt.hash(tempPassword, 10);

    // Atomic: INSERT into users + UPDATE user_pending must commit together.
    // Without the transaction, an UPDATE failure mid-flight (DB hiccup, connection
    // drop) leaves a users row created with the pending row still 'pending' — so
    // the next approval attempt would create a duplicate user (ER_DUP_ENTRY) and
    // the pending row would never get marked 'approved'.
    const userId = await db.tx(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO users (username, password_hash, full_name, phone, role, stream, managed_by, force_password_change)
         VALUES (?,?,?,?,?,?,?,1)`,
        [pending.username, hash, pending.full_name, pending.phone, pending.role, pending.stream, req.session.user.id]
      );
      const sm = require('../../../services/state-machines').userPending;
      await sm.transition({
        id: parseInt(req.params.id, 10), from: 'pending', to: 'approved',
        extraCols: { reviewed_by: req.session.user.id, reviewed_at: new Date() },
        conn,
      });
      return result.insertId;
    });

    // Audit (helper captures ip + user-agent)
    const audit = require('../../../services/audit');
    audit.log({
      userId:     req.session.user.id,
      action:     'user.approve',
      entityType: 'users',
      entityId:   userId,
      details:    { pending_id: parseInt(req.params.id, 10), username: pending.username, role: pending.role },
      req,
    });

    // Send activation message to new user with their temp password (outside tx).
    if (pending.phone) await notif.notifyUserActivated(pending.phone, pending.username, tempPassword);

    res.json({ success: true, user_id: userId, message: `${pending.full_name} account created. Notification sent with credentials.` });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists in system' });
    console.error('[user-management/approve]', err.message);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// POST /api/user-management/:id/reject
router.post('/:id/reject', requireAuth, requirePrincipal, async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    // Constrain to status='pending' so an already-approved or already-rejected
    // row can't be silently overwritten by a stale UI tap. The state machine's
    // concurrency guard (WHERE status=from) provides this naturally — it returns
    // affectedRows=0 if the row was already transitioned out of 'pending'.
    const sm = require('../../../services/state-machines').userPending;
    let result;
    try {
      result = await sm.transition({
        id: parseInt(req.params.id, 10), from: 'pending', to: 'rejected',
        extraCols: {
          reviewed_by: req.session.user.id, reviewed_at: new Date(),
          rejection_reason: rejection_reason || null,
        },
      });
    } catch (err) {
      // SM throws StateTransitionError when affectedRows=0 (row already moved).
      // Distinguish "row doesn't exist" from "row is in a non-pending status".
      const [[row]] = await db.query('SELECT status FROM user_pending WHERE id=?', [req.params.id]);
      if (!row) return res.status(404).json({ error: 'Pending user not found' });
      return res.status(409).json({
        error: `Cannot reject — pending request is already '${row.status}'.`,
        code:  'PENDING_NOT_OPEN',
        current_status: row.status,
      });
    }
    const audit = require('../../../services/audit');
    audit.log({
      userId:     req.session.user.id,
      action:     'user.reject',
      entityType: 'user_pending',
      entityId:   parseInt(req.params.id, 10),
      details:    { reason: rejection_reason || null },
      req,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[user-management/reject]', err.message);
    res.status(500).json({ error: 'Reject failed' });
  }
});

module.exports = router;
