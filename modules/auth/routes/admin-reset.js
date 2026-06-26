// routes/admin-reset.js — in-app password reset by manager
//
// Who can reset:
//   - IT Admin: any user
//   - Principal: any user
//   - PMC Head: site_manager, senior_site_manager, coordinator
//   - Design Head: jr_architect, team_lead, jr_engineer
//   - Services Head: services_engineer
//
// Flow:
//   1. Caller taps "Reset password" on a user in User Management
//   2. Server generates a memorable temp password (Apple-style: Word-NN-Word)
//   3. Temp password stored in users.temp_password (plaintext — 1 use only)
//   4. force_password_change = 1 set
//   5. Temp password shown on screen so caller can read it to the user
//   6. User logs in with temp password → forced to change immediately
//   7. On successful password change, temp_password cleared to NULL
//
// Email principle: no automatic message sent to anyone on reset.
// The temp password is communicated verbally or by the manager's choice.

const express = require('express');
const router  = express.Router();
const db      = require('../../../middleware/db');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const audit   = require('../../../services/audit');
const { requireAuth } = require('../../../middleware/auth');
const asyncHandler    = require('../../../middleware/asyncHandler');

// ── WHO CAN RESET WHOM ────────────────────────────────────────────────────
// Principals and IT Admin can reset anyone.
// All other roles can only reset users where managed_by = their own id.
const FULL_ACCESS_ROLES = new Set(['principal', 'design_principal', 'it_admin']);

function canReset(caller, target) {
  if (caller.id === target.id) return false;            // never own password
  if (FULL_ACCESS_ROLES.has(caller.role)) return true;  // principals / IT admin — unrestricted
  // Privilege-escalation guard: a non-privileged manager must NEVER be able to
  // reset a privileged account, even if a managed_by row mistakenly points at
  // one. Without this, a data error could hand a principal/IT-admin takeover.
  if (FULL_ACCESS_ROLES.has(target.role)) return false;
  return target.managed_by === caller.id;               // everyone else — direct reports only
}

// ── MEMORABLE PASSWORD GENERATOR ─────────────────────────────────────────
// Format: Word-NN-Word  e.g. "Mango-47-River"
// Uses common English nouns — easy to spell over phone, no l/1/O/0 ambiguity.
const WORDS = [
  'Mango','River','Tiger','Cloud','Stone','Bridge','Flame','Grain',
  'Cedar','Amber','Lotus','Coral','Maple','Crisp','Frost','Haven',
  'Birch','Drake','Ember','Flint','Grove','Hedge','Inlet','Jasper',
  'Knoll','Larch','Marsh','Nimbus','Ochre','Polar','Quartz','Ridge',
  'Sable','Thorn','Umber','Vale','Willow','Xenon','Yield','Zenith',
];

function generateTempPassword() {
  // Use crypto.randomInt — predictable Math.random would let an attacker who
  // knows the reset time (visible in audit_log) narrow the temp password to
  // a small candidate set.
  const w1  = WORDS[crypto.randomInt(WORDS.length)];
  const w2  = WORDS[crypto.randomInt(WORDS.length)];
  const num = String(crypto.randomInt(10, 100));  // 10–99 inclusive
  return `${w1}-${num}-${w2}`;
}

// ── GET USERS ELIGIBLE FOR RESET (by current user) ────────────────────────
router.get('/resettable-users', requireAuth, asyncHandler(async (req, res) => {
  const caller = req.session.user;

  // Principals/IT-admin see everyone. Others see only their direct reports.
  let rows;
  if (FULL_ACCESS_ROLES.has(caller.role)) {
    [rows] = await db.query(
      `SELECT id, username, full_name, role, managed_by, is_active FROM users ORDER BY full_name`);
  } else {
    [rows] = await db.query(
      `SELECT id, username, full_name, role, managed_by, is_active FROM users WHERE managed_by = ? ORDER BY full_name`,
      [caller.id]);
  }

  const eligible = rows.filter(u => u.id !== caller.id);
  res.json({ users: eligible });
}));

// ── RESET A USER'S PASSWORD ───────────────────────────────────────────────
router.post('/reset/:userId', requireAuth, asyncHandler(async (req, res) => {
  const caller   = req.session.user;
  const targetId = parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user id' });

  // Fetch target user (need managed_by for the permission check)
  const [rows] = await db.query(
    `SELECT id, username, full_name, role, managed_by FROM users WHERE id=?`, [targetId]);
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const target = rows[0];

  // Permission check — principal/IT-admin unrestricted; others: direct reports only
  if (!canReset(caller, target)) {
    return res.status(403).json({ error: 'You can only reset passwords for your direct reports' });
  }

  // Generate temp password
  const tempPw   = generateTempPassword();
  const tempHash = await bcrypt.hash(tempPw, 10);

  await db.query(
    `UPDATE users SET
       password_hash        = ?,
       temp_password        = ?,
       force_password_change = 1,
       reset_by             = ?,
       reset_at             = NOW()
     WHERE id = ?`,
    [tempHash, tempPw, caller.id, targetId]
  );

  // Audit log — uses the helper so ip_address + user_agent are captured.
  audit.log({
    userId:     caller.id,
    action:     'password.reset',
    entityType: 'users',
    entityId:   targetId,
    details:    { note: `Reset by ${caller.username} (${caller.role})` },
    req,
  });

  // Return temp password to caller — shown on screen so they can read it to the user.
  // NOT sent via email/WA automatically.
  res.json({
    success: true,
    temp_password: tempPw,
    full_name: target.full_name,
    username:  target.username,
    message:   `Password reset. Read this code to ${target.full_name}.`,
  });
}));

// ── SEND TEMP PASSWORD VIA MATRIX (principal-initiated, optional) ────────
// Called from the reset-password modal after the temp password is generated.
router.post('/send-wa/:userId', requireAuth, asyncHandler(async (req, res) => {
  const caller   = req.session.user;
  const targetId = parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid user id' });

  const [rows] = await db.query(
    `SELECT id, username, full_name, role, managed_by, phone, temp_password, matrix_room_id
     FROM users WHERE id=?`, [targetId]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  const target = rows[0];

  if (!canReset(caller, target)) {
    return res.status(403).json({ error: 'You can only send password resets for your direct reports' });
  }

  if (!target.temp_password) return res.status(400).json({ error: 'No active temporary password. Reset the password first.' });
  if (!target.matrix_room_id) {
    return res.status(400).json({
      error: `${target.full_name} is not on Matrix yet. Read the temporary password to them over the phone instead.`,
      code: 'NO_MATRIX_ROOM',
    });
  }

  const body =
    `nu PMC — Your password has been reset.\n\n` +
    `Username: ${target.username}\n` +
    `Temporary password: ${target.temp_password}\n\n` +
    `Sign in at the app and you will be asked to change this immediately.\n` +
    `If you did not request this, contact ${caller.username} or Principal.`;

  try {
    const matrixAdapter = require('../../../services/matrix-adapter');
    await matrixAdapter.sendText({ roomId: target.matrix_room_id, body, recipientUid: target.id });

    audit.log({
      userId:     caller.id,
      action:     'password.reset.sent_matrix',
      entityType: 'users',
      entityId:   targetId,
      details:    { note: `Sent temp password to ${target.full_name} via Matrix DM` },
      req,
    });

    res.json({ success: true, message: `Temporary password sent to ${target.full_name} via Matrix.` });
  } catch (err) {
    console.error('[admin-reset/send-wa] Matrix send failed:', err.message);
    res.status(502).json({
      error: 'Matrix send failed. Read the password to them over the phone instead. Error: ' + (err.message || 'unknown'),
    });
  }
}));

// ── WA FAILURE SUMMARY (IT Admin + Principal only) ────────────────────────
router.get('/wa-failures', requireAuth, asyncHandler(async (req, res) => {
  const role = req.session.user.role;
  if (!['principal','design_principal','it_admin'].includes(role)) {
    return res.json({ failures: [] });
  }
  const [rows] = await db.query(
    `SELECT message_type,
            COUNT(*) AS count,
            MIN(attempted_at) AS oldest
     FROM wa_send_failures
     WHERE resolved_at IS NULL
     GROUP BY message_type
     ORDER BY count DESC
     LIMIT 10`
  );
  res.json({ failures: rows.map(r => ({
    message_type: r.message_type,
    count:        r.count,
    oldest:       r.oldest ? new Date(r.oldest).toLocaleDateString('en-IN') : null,
  })) });
}));

module.exports = router;
