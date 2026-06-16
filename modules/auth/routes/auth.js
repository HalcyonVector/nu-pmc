// routes/auth.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const db       = require('../../../middleware/db');
const { requireAuth, PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router   = express.Router();

// Roles that see only their assigned projects via project_assignments.
// Mirrored client-side in some UI flows; SCOPED is the source of truth.
// Non-scoped firm-wide roles see all active projects via getActiveProjects.
const PROJECT_WIDE_ROLES = [
  'principal','design_principal','pmc_head','design_head',
  'services_head','finance_admin','audit'
];

/**
 * Load the project list this user should see in their project selector.
 * Called from login (initial seed) and /refresh-projects (when assignments
 * change while the user is logged in).
 *
 * Returns [] for IT Admin and any role outside both scoped + firm-wide buckets.
 *
 * Impersonation: when a Principal sudoes into another role, `user.real_role`
 * holds 'principal' and `user.role` holds the impersonated role. Project
 * visibility must follow the *real* role — the Principal still has firm-wide
 * access; the role-switch is for UI/feature lensing, not for narrowing data
 * visibility (and a project-scoped impersonated role would otherwise return
 * an empty list, since principals aren't in project_assignments).
 */
async function loadProjectsForUser(user) {
  const role = user.real_role || user.role;
  if (PROJECT_SCOPED_ROLES.includes(role)) {
    // Bug 6 — completed projects must not appear in scoped users' selectors.
    // 'initialising' and 'active' remain visible. Add 'on_hold' here if that
    // policy is later set (currently on_hold writes are NOT blocked, so the
    // project should remain visible to scoped users for the same reason).
    const [projects] = await db.query(
      `SELECT p.id, p.code, p.name, p.client, p.location FROM project_assignments pa
       JOIN projects p ON pa.project_id = p.id
       WHERE pa.user_id = ? AND pa.is_active = 1
         AND p.status != 'completed'
       ORDER BY p.name`,
      [user.id]
    );
    return projects;
  }
  if (PROJECT_WIDE_ROLES.includes(role)) {
    const Onboarding = require('../../onboarding/contract');
    return await Onboarding.functions.getActiveProjects();
  }
  return [];
}

// ── DEV ROLE SWITCHER — local testing only ─────────────────────────────────
// POST /api/auth/dev-login  { username, password: 'Start@123' }
//   → returns list of all users for role picker
// POST /api/auth/dev-switch { user_id }
//   → switches session to that user, returns same payload as /login
//
// ONLY active when NODE_ENV=development. Completely disabled in production.
// To disable: set NODE_ENV=production in .env (or any value other than 'development').
//
// Credentials: user1 / Start@123 (set in seed via dev-seed.sql)

if (process.env.NODE_ENV === 'development') {
  const DEV_PASSWORD = 'Start@123';
  const DEV_USERNAME = 'user1';

  router.post('/dev-login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (username !== DEV_USERNAME || password !== DEV_PASSWORD) {
      return res.status(401).json({ error: 'Invalid dev credentials' });
    }

    // Return all active users grouped by role for the picker
    const [users] = await db.query(
      `SELECT id, username, full_name, role, stream
         FROM users WHERE is_active = 1
         ORDER BY role, full_name`
    );

    res.json({ dev: true, users });
  }));

  router.post('/dev-switch', asyncHandler(async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const [rows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1', [user_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    const projects = await loadProjectsForUser(user);

    req.session.user = {
      id: user.id, username: user.username, full_name: user.full_name,
      role: user.role, stream: user.stream, managed_by: user.managed_by,
      matrix_room_id: user.matrix_room_id, matrix_user_id: user.matrix_user_id,
      force_password_change: false, projects,
    };

    const DateUtil = require('../../../services/date-util');
    res.json({
      success: true, dev: true,
      user: req.session.user,
      force_password_change: false,
      today: DateUtil.todayIST(),
    });
  }));
}

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username.toLowerCase().trim()]
    );

    if (!rows.length) return res.status(401).json({ error: 'Invalid username or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    // Verify the user's role has at least one nav row in role_nav.
    // Without this, the user logs in successfully but lands on an empty
    // app shell — pure DB-driven nav has no fallback. Reject at login time
    // so they get a clear message instead of a broken session.
    const [navRows] = await db.query(
      'SELECT 1 FROM role_nav WHERE role = ? AND is_visible = 1 LIMIT 1',
      [user.role]
    );
    if (!navRows.length) {
      return res.status(403).json({
        error: 'Your account is not fully configured — please contact IT admin.',
        code:  'ROLE_NAV_MISSING',
      });
    }

    // Must-change-password check: default password still active AND login
    // count has reached the threshold, OR force_password_change flag is set
    // (admin-reset). Threshold is 1 — users must change on first login.
    const FORCE_CHANGE_AFTER = 25;
    await db.query('UPDATE users SET login_count = login_count + 1 WHERE id = ?', [user.id]);
    const [[countRow]] = await db.query('SELECT login_count FROM users WHERE id = ?', [user.id]);
    const loginCount = countRow.login_count;
    const isDefault  = await bcrypt.compare('Start@123', user.password_hash);
    const mustChange = (isDefault && loginCount >= FORCE_CHANGE_AFTER) || (user.force_password_change === 1);

    // Session fixation defence (Bug #31): regenerate the session ID
    // after authentication. Otherwise an attacker who plants a known
    // session ID before the victim logs in retains a logged-in session.
    // Node's express-session takes a callback here — wrap in a Promise
    // so we can await it in the asyncHandler body.
    await new Promise((resolve, reject) => {
      req.session.regenerate(err => err ? reject(err) : resolve());
    });

    // Set session
    req.session.user = {
      id:                  user.id,
      username:            user.username,
      full_name:           user.full_name,
      role:                user.role,
      stream:              user.stream,
      must_change_password: mustChange,
    };

    // Load assigned projects for all project-scoped roles, or all active
    // projects for firm-wide roles. See loadProjectsForUser() above.
    req.session.user.projects = await loadProjectsForUser(user);
    req.session.user.projects_at = Date.now();

    // Issue a CSRF token bound to this session. Stored on session and set
    // as a non-httpOnly cookie the frontend reads before its first write.
    // Per-session rotation: the same token is valid for the life of the
    // session; logout clears it.
    const { issueToken } = require('../../../middleware/csrf');
    const csrfToken = issueToken(req, res);

    const DateUtil = require('../../../services/date-util');
    res.json({
      success: true,
      csrf_token: csrfToken,
      today: DateUtil.todayIST(),
      user: {
        id:                   user.id,
        username:             user.username,
        full_name:            user.full_name,
        role:                 user.role,
        stream:               user.stream,
        must_change_password: mustChange,
        projects:             req.session.user.projects || [],
      }
    });

  }));

// POST /api/auth/logout
// Bug #32: Earlier this called req.session.destroy() and responded
// immediately — destroy is async and could fail silently, leaving the
// cookie valid. Now we await destroy and explicitly clear the client
// cookie. Name 'connect.sid' is express-session's default; change here
// if you ever set a custom `name:` in the session middleware config.
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('[auth] session destroy failed:', err.message);
      // Even if destroy failed, clear the cookie client-side so the
      // browser stops sending it.
    }
    res.clearCookie('connect.sid');
    // Clear the CSRF cookie too — session is gone, token is invalid.
    const { COOKIE_NAME: CSRF_COOKIE } = require('../../../middleware/csrf');
    res.clearCookie(CSRF_COOKIE);
    res.json({ success: true });
  });
});

// GET /api/auth/me — check current session.
// Returns {user: null} on no session rather than 401. This is the "am I logged
// in?" check from page-load; treating it as an error pollutes the browser
// console and misrepresents it as a failure. Real endpoints stay behind
// requireAuth.
router.get('/me', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const DateUtil = require('../../../services/date-util');
  const today = DateUtil.todayIST();
  if (req.session?.user) {
    return res.json({ user: req.session.user, today });
  }
  res.json({ user: null, today });
});

// POST /api/auth/refresh-projects — re-pull the user's project list and update
// their session. Needed because projects are cached on the session at login;
// without this, an assignment change (added or removed) doesn't take effect
// until the user logs out and back in.
//
// Frontend calls this:
//   - on app focus / window regain (in case assignments changed elsewhere)
//   - after any UI action that adds or removes the user from a project
// Returns the same shape as login's user.projects field.
router.post('/refresh-projects', requireAuth, asyncHandler(async (req, res) => {
  const projects = await loadProjectsForUser(req.session.user);
  req.session.user.projects = projects;
  req.session.user.projects_at = Date.now();
  res.json({ projects });
}));

// ── PRINCIPAL ROLE IMPERSONATION ──────────────────────────────────────────
// Lets a real Principal "sudo" into any other role to view the app as that
// role would. session.user.role is mutated to the impersonated role so every
// downstream middleware + route gate behaves naturally; the real role is
// preserved in session.user.real_role so the user can return.
//
// Audit-logged on both entry and exit. Only allowed when the *real* role is
// 'principal' — design_principal cannot use this in line with current spec.
const IMPERSONATABLE_ROLES = [
  'principal','design_principal','design_head','team_lead','services_head',
  'jr_architect','jr_engineer','services_engineer','coordinator',
  'pmc_head','site_manager','senior_site_manager','finance_admin','trainee',
  'audit','it_admin'
];

router.post('/impersonate', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const realRole = me.real_role || me.role;
  if (realRole !== 'principal') {
    return res.status(403).json({ error: 'Only Principal can impersonate other roles' });
  }
  const target = String(req.body?.role || '').trim();
  if (!IMPERSONATABLE_ROLES.includes(target)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Switching to your own real role = end impersonation.
  if (target === realRole) {
    if (me.real_role) {
      audit.log({ userId: me.id, action: 'auth.end_impersonation',
        entityType: 'users', entityId: me.id,
        details: { from_role: me.role }, req });
      me.role = me.real_role;
      delete me.real_role;
    }
    return res.json({ user: me });
  }

  audit.log({ userId: me.id, action: 'auth.start_impersonation',
    entityType: 'users', entityId: me.id,
    details: { from_role: realRole, to_role: target }, req });
  me.real_role = realRole;
  me.role = target;
  res.json({ user: me });
}));

router.post('/end-impersonation', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  if (!me.real_role) {
    return res.json({ user: me });   // not impersonating; idempotent no-op
  }
  audit.log({ userId: me.id, action: 'auth.end_impersonation',
    entityType: 'users', entityId: me.id,
    details: { from_role: me.role }, req });
  me.role = me.real_role;
  delete me.real_role;
  res.json({ user: me });
}));

// POST /api/auth/request-otp — WhatsApp OTP for password reset
// POST /api/auth/request-otp — REMOVED in v3.1. Self-service password reset deleted 2026-04-21.
// Users ask their manager (or Naveen/Ajay) to reset via the Users tab in the app.
router.post('/request-otp', asyncHandler(async (req, res) => {
  res.status(410).json({
    error: 'Self-service password reset has been removed. Ask your manager or Naveen/Ajay to reset your password.',
    code:  'SELF_SERVICE_OTP_REMOVED'
  });
}));

// POST /api/auth/verify-otp — REMOVED in v3.1. Self-service password reset deleted 2026-04-21.
router.post('/verify-otp', asyncHandler(async (req, res) => {
  res.status(410).json({
    error: 'Self-service password reset has been removed. Ask your manager or Naveen/Ajay to reset your password.',
    code:  'SELF_SERVICE_OTP_REMOVED'
  });
}));

// POST /api/auth/change-password
router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });

    const policy = require('../../../services/password-policy');
    const pv = policy.validate(new_password, { username: req.session.user.username });
    if (!pv.ok) return res.status(400).json({ error: pv.error });

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.session.user.id]);
    if (!rows.length) {
      // User deleted between session creation and this request. Destroy the
      // stale session so the client knows to re-login.
      req.session?.destroy(() => {});
      return res.status(401).json({ error: 'Session no longer valid', code: 'SESSION_USER_GONE' });
    }
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    // Reject reuse of current password
    if (await bcrypt.compare(new_password, rows[0].password_hash)) {
      return res.status(400).json({ error: 'New password must be different from current' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, force_password_change = 0, temp_password = NULL WHERE id = ?',
      [hash, req.session.user.id]
    );
    // Keep session in sync so subsequent requests in this session see the cleared flag
    if (req.session.user) req.session.user.must_change_password = false;
    audit.log({ userId: req.session.user.id, action: 'auth.password_change', entityType: 'users', entityId: req.session.user.id, req });
    res.json({ success: true });

  }));

// POST /api/auth/reset-password — admin resets for their team
router.post('/reset-password', requireAuth, asyncHandler(async (req, res) => {
    const { user_id, new_password } = req.body;
    const me = req.session.user;

    // Check this user manages the target user
    const [target] = await db.query('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!target.length) return res.status(404).json({ error: 'User not found' });

    const t = target[0];
    const isPrincipal = ['principal', 'design_principal'].includes(me.role);
    const isManager   = t.managed_by === me.id;

    if (!isPrincipal && !isManager) {
      return res.status(403).json({ error: 'You cannot reset this user\'s password' });
    }

    if (!new_password || typeof new_password !== 'string') {
      return res.status(400).json({ error: 'new_password required' });
    }
    const policy = require('../../../services/password-policy');
    const pv = policy.validate(new_password, { username: t.username });
    if (!pv.ok) return res.status(400).json({ error: pv.error });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, force_password_change = 1 WHERE id = ?',
      [hash, user_id]
    );
    audit.log({ userId: me.id, action: 'auth.password_reset', entityType: 'users', entityId: user_id, details: { target: t.full_name }, req });
    res.json({ success: true, message: `Password reset for ${t.full_name}. They will be asked to change it on next login.` });

  }));

module.exports = router;
module.exports.loadProjectsForUser = loadProjectsForUser;
