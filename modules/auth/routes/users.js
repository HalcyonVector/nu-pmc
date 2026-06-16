// routes/users.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const db       = require('../../../middleware/db');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const { validators } = require('../../../middleware/validate');
const router   = express.Router();
const xl       = require('../../../middleware/excel');
const { upload } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const waLink = require('../../../services/wa-link');

// GET /api/users — get users this person can manage
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    let query, params;

    if (['principal', 'design_principal', 'audit'].includes(me.role)) {
      // Principals + audit see everyone
      [query, params] = ['SELECT id, username, full_name, role, stream, managed_by, is_active FROM users ORDER BY role, full_name', []];
    } else {
      // Others see only their direct reports
      [query, params] = ['SELECT id, username, full_name, role, stream, managed_by, is_active FROM users WHERE managed_by = ? ORDER BY full_name', [me.id]];
    }

    const [users] = await db.query(query, params);
    res.json({ users });

  }));

// GET /api/users/me — current user's profile (with deputy_id)
// Used by the Profile screen to render deputy & leave UI.
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[user]] = await db.query(
      `SELECT id, username, full_name, role, stream, managed_by, is_active,
              deputy_id, deputy_from, deputy_until, deputy_reason,
              deputy_set_by, deputy_overridden_by, deputy_overridden_at
         FROM users WHERE id = ?`,
      [me.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Hydrate deputy_name, set_by_name, overridden_by_name for UI display
    const ids = [user.deputy_id, user.deputy_set_by, user.deputy_overridden_by].filter(Boolean);
    if (ids.length) {
      const [rows] = await db.query(
        `SELECT id, full_name FROM users WHERE id IN (?)`, [ids]);
      const m = new Map(rows.map(r => [r.id, r.full_name]));
      user.deputy_name           = m.get(user.deputy_id)            || null;
      user.deputy_set_by_name    = m.get(user.deputy_set_by)        || null;
      user.deputy_overridden_by_name = m.get(user.deputy_overridden_by) || null;
    }
    res.json({ user });
  }));

// POST /api/users/me/leave — record a leave request for the current user
// Stored in user_leave_requests; the existing delegations module handles the
// actual deputisation while the user is away. This endpoint just records intent.
router.post('/me/leave', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { UserLeave, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(UserLeave, req, res);
    if (!body) return;
    const { from_date, to_date, reason } = body;
    if (new Date(to_date) < new Date(from_date)) {
      return res.status(400).json({ error: 'to_date must be on or after from_date' });
    }
    const [r] = await db.query(
      `INSERT INTO user_leave_requests (user_id, from_date, to_date, reason)
       VALUES (?,?,?,?)`,
      [me.id, from_date, to_date, reason || null]
    );
    audit.log({ userId: me.id, action: 'user.leave_recorded',
      entityType: 'user_leave_requests', entityId: r.insertId,
      details: { from_date, to_date, reason: reason || null }, req });
    res.json({ success: true, message: 'Leave recorded — your deputy will see this in their queue.' });
  }));

// POST /api/users — create new user (principals only)
router.post('/', requireAuth, requirePrincipal, validators.userCreate, async (req, res) => {
  try {
    const { username, full_name, role, stream, managed_by, phone, email, password } = req.body;
    if (!username || !full_name || !role) return res.status(400).json({ error: 'Username, full name and role required' });

    // Default password is Start@123 for all new users.
    // force_password_change=1 means user MUST change it on first login.
    // See auth.js for the threshold. This removes the WhatsApp/phone dependency
    // for communicating temp passwords to new users.
    const initPassword = password || 'Start@123';
    const hash = await bcrypt.hash(initPassword, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, full_name, role, stream, managed_by, phone, email, force_password_change) VALUES (?,?,?,?,?,?,?,?,1)',
      [username.toLowerCase(), hash, full_name, role, stream || 'all', managed_by || null, phone||null, email||null]
    );

    audit.log({ userId: req.session.user.id, action: 'user.create',
      entityType: 'users', entityId: result.insertId,
      details: { username: username.toLowerCase(), full_name, role, stream: stream || 'all', managed_by: managed_by || null }, req });

    // Auto-provision Matrix identity for internal users (P2.1, v2 brief).
    // matrix_user_id  — derived from username + homeserver domain. No API call needed.
    // matrix_room_id  — personal DM room created via Matrix API (bot invites user).
    //                   Non-blocking: failure does not prevent user creation.
    //                   Admin can manually set both columns if provisioning fails.
    let matrixUserId  = null;
    let matrixRoomId  = null;
    try {
      const matrixAdapter = require('../../../services/matrix-adapter');
      matrixUserId = matrixAdapter.deriveMatrixUserId(username.toLowerCase());
      if (matrixUserId) {
        matrixRoomId = await matrixAdapter.createUserDMRoom(matrixUserId);
        if (matrixUserId || matrixRoomId) {
          await db.query(
            'UPDATE users SET matrix_user_id = ?, matrix_room_id = ? WHERE id = ?',
            [matrixUserId, matrixRoomId, result.insertId]
          );
        }
      }
    } catch (e) {
      console.warn('[users.create] Matrix provisioning failed (non-fatal):', e.message);
    }

    // U1: Don't include the password in the JSON response — it survives in
    // browser network logs and frontend memory. Match user-management.js
    // approve flow: send the activation message if a notification channel is
    // available. If not, surface a one-off display channel only when the
    // caller explicitly opted in via ?reveal_password=1 (so the principal
    // sees it once, on a non-shared screen, when there is no other channel).
    //
    // Matrix migration May 2026: switched from phone-based to userId-based
    // dispatch. The new user's id is result.insertId — messaging.notifyUser
    // resolves Matrix DM or WA bridge depending on the user.
    // U1: Don't include the password in the JSON response — it survives in
    // browser network logs and frontend memory. Match user-management.js
    // approve flow: send via the notification channel if phone is on file.
    // If no phone given, surface a one-off display channel only when the
    // caller explicitly opted in via ?reveal_password=1 (so the principal
    // sees it once, on a non-shared screen, when there is no other channel).
    let passwordSent = false;
    if (phone) {
      try {
        const notif = require('../../../services/notifications');
        await notif.notifyUserActivated(phone, username.toLowerCase(), initPassword);
        passwordSent = true;
      } catch (e) {
        console.error('[users.create notify] swallowed:', e.message);
      }
    }

    const revealPassword = req.query?.reveal_password === '1' && !passwordSent;
    const response = {
      success: true,
      id: result.insertId,
      matrix_user_id:  matrixUserId  || null,
      matrix_room_id:  matrixRoomId  || null,
      message: passwordSent
        ? `User created. Temporary password sent via WhatsApp to ${phone}.`
        : revealPassword
          ? 'User created. Temporary password shown once below — record it now and share securely.'
          : 'User created. No phone on file — re-create with phone, or call this endpoint with ?reveal_password=1 to see the temporary password once.',
    };
    if (revealPassword) response.temp_password = initPassword;
    res.json(response);

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Username already exists' });
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id/deputy — role owner sets their deputy
// PATCH /api/users/:id/deputy — primary endpoint used by Profile UI.
// Self: sets your own deputy (with optional time bounds + reason).
// Principal/design_principal acting on someone else's id: stamps override audit.
// Anyone else: 403.
router.patch("/:id/deputy", requireAuth, async (req, res) => {
  try {
    const { DeputyAssign, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(DeputyAssign, req, res);
    if (!body) return;
    const { deputy_id, deputy_from, deputy_until, deputy_reason } = body;
    const me = req.session.user;
    const targetId = parseInt(req.params.id);
    const isSelf = targetId === me.id;
    const isPrincipal = ["principal","design_principal"].includes(me.role);
    if (!isSelf && !isPrincipal) {
      return res.status(403).json({ error: 'Can only set your own deputy' });
    }
    if (deputy_id && parseInt(deputy_id) === targetId) {
      return res.status(400).json({ error: 'Cannot set self as deputy' });
    }
    if (deputy_id) {
      const [[other]] = await db.query('SELECT deputy_id FROM users WHERE id=?', [deputy_id]);
      if (other && parseInt(other.deputy_id) === targetId) {
        return res.status(400).json({ error: 'Cycle detected — this would create a mutual deputy loop' });
      }
    }
    if (deputy_from && deputy_until && new Date(deputy_until) < new Date(deputy_from)) {
      return res.status(400).json({ error: 'deputy_until must be on or after deputy_from' });
    }
    if (!deputy_id) {
      await db.query(
        `UPDATE users SET deputy_id=NULL, deputy_from=NULL, deputy_until=NULL,
                          deputy_reason=NULL, deputy_set_by=NULL,
                          deputy_overridden_by=NULL, deputy_overridden_at=NULL
         WHERE id=?`, [targetId]);
      audit.log({ userId: me.id, action: 'user.deputy_clear',
        entityType: 'users', entityId: targetId,
        details: { is_self: isSelf }, req });
      return res.json({ success: true, message: 'Deputy removed' });
    }
    if (isSelf) {
      await db.query(
        `UPDATE users SET deputy_id=?, deputy_from=?, deputy_until=?, deputy_reason=?,
                          deputy_set_by=?, deputy_overridden_by=NULL, deputy_overridden_at=NULL
         WHERE id=?`,
        [deputy_id, deputy_from || null, deputy_until || null, deputy_reason || null, me.id, targetId]
      );
      audit.log({ userId: me.id, action: 'user.deputy_set',
        entityType: 'users', entityId: targetId,
        details: { deputy_id: parseInt(deputy_id), deputy_from: deputy_from || null, deputy_until: deputy_until || null, reason: deputy_reason || null, is_self: true }, req });
    } else {
      // Principal override path — stamps overridden_by + overridden_at
      await db.query(
        `UPDATE users SET deputy_id=?, deputy_from=?, deputy_until=?, deputy_reason=?,
                          deputy_set_by=?, deputy_overridden_by=?, deputy_overridden_at=NOW()
         WHERE id=?`,
        [deputy_id, deputy_from || null, deputy_until || null, deputy_reason || null,
         me.id, me.id, targetId]
      );
      audit.log({ userId: me.id, action: 'user.deputy_override',
        entityType: 'users', entityId: targetId,
        details: { deputy_id: parseInt(deputy_id), deputy_from: deputy_from || null, deputy_until: deputy_until || null, reason: deputy_reason || null, principal_override: true }, req });
    }
    res.json({ success: true, message: 'Deputy assigned' });
  } catch (err) { console.error('[users PATCH deputy]', err); res.status(500).json({ error: 'Deputy update failed' }); }
});

// PATCH /api/users/:id/deactivate
router.patch('/:id/deactivate', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [target] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!target.length) return res.status(404).json({ error: 'User not found' });

    const t = target[0];
    const isPrincipal = ['principal', 'design_principal'].includes(me.role);
    const isManager   = t.managed_by === me.id;

    if (!isPrincipal && !isManager) return res.status(403).json({ error: 'Cannot deactivate this user' });

    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    audit.log({ userId: me.id, action: 'user.deactivate',
      entityType: 'users', entityId: parseInt(req.params.id),
      details: { target_username: t.username, target_role: t.role }, req });
    res.json({ success: true });

  }));

// POST /api/users/bulk-upload — Principal uploads Excel with all team members
router.post('/bulk-upload', requireAuth, upload.single('users'), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { can } = require('../../../middleware/permissions');
    if (!(await can(me.role, 'users.bulk_upload'))) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = await xl.readFile(file.path);
    const bcrypt = require('bcryptjs');
    let added = 0, skipped = 0, errors = [];

    const VALID_ROLES = ['principal','design_principal','pmc_head','design_head','services_head',
      'team_lead','jr_architect','jr_engineer','services_engineer','team_lead','coordinator',
      'site_manager','senior_site_manager','finance_admin','trainee','audit','it_admin'];

    const VALID_STREAMS = ['design','services','pmc','site','all'];

    for (const row of rows) {
      const username  = (row['Username']  || row['username']  || '').toString().trim().toLowerCase();
      const fullName  = (row['Full Name'] || row['full_name'] || '').toString().trim();
      const role      = (row['Role']      || row['role']      || '').toString().trim().toLowerCase().replace(/ /g,'_');
      // Phone — route through normalisePhone so leading 0 / 00 / +91 prefixes
      // are handled consistently with wa.me link generation. Empty input returns
      // null which we store as NULL (phone is optional for users).
      const phoneRaw  = (row['Phone']     || row['phone']     || '').toString().trim();
      const phone     = phoneRaw ? (waLink.normalisePhone(phoneRaw) || '') : '';
      if (phoneRaw && !phone) { errors.push(`${fullName}: invalid phone '${phoneRaw}'`); skipped++; continue; }
      const email     = (row['Email']     || row['email']     || '').toString().trim();
      const stream    = (row['Stream']    || row['stream']    || 'all').toString().trim().toLowerCase();

      if (!username || !fullName || !role) { skipped++; continue; }
      if (!VALID_ROLES.includes(role)) { errors.push(`${fullName}: invalid role '${role}'`); skipped++; continue; }

      const [[existing]] = await db.query('SELECT id FROM users WHERE username=?', [username]);
      if (existing) { skipped++; continue; }

      // U5: Math.random is not cryptographically secure. crypto.randomBytes
      // matches the practice already used in admin-reset.js and
      // user-management.js approve flows. 6 bytes hex = 12 chars, ~48 bits
      // entropy — adequate for a one-time password the user must change.
      const tempPassword = 'tmp-' + crypto.randomBytes(6).toString('hex');
      const hash = await bcrypt.hash(tempPassword, 10);
      await db.query(
        `INSERT INTO users (username, password_hash, full_name, role, phone, email, stream,
         is_active, force_password_change)
         VALUES (?,?,?,?,?,?,?,1,1)`,
        [username, hash, fullName, role,
         phone||null, email||null,
         VALID_STREAMS.includes(stream) ? stream : 'all']
      );
      if (!res.locals.tempPasswords) res.locals.tempPasswords = [];
      res.locals.tempPasswords.push({ username, temp_password: tempPassword });
      added++;
    }

    audit.log({ userId: me.id, action: 'users.bulk_upload',
      entityType: 'users', entityId: null,
      details: { added, skipped, error_count: errors.length, file_path: file.path }, req });

    res.json({
      success: true, added, skipped,
      errors: errors.length ? errors : undefined,
      temp_passwords: res.locals.tempPasswords || [],
      message: `${added} users created, ${skipped} skipped. Share each user's temp password individually — they will be forced to change on first login.`,
    });
  }));

module.exports = router;
