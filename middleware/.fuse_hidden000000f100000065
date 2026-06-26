// middleware/must-change-password.js
//
// Blocks all API access for users whose `force_password_change=1` flag is set
// (carried into session as `must_change_password`), except for the three
// endpoints they need to actually change it: change-password, me, logout.
//
// Why this exists
// ---------------
// The flag is set by the admin-reset flow and the bulk-upload flow when a
// random temp password is generated for a user. The frontend honours the flag
// and shows the change-password modal before any other UI loads. But a session
// cookie used outside the web UI (mobile app, curl, Postman, automated script)
// is not subject to that frontend gate. Without a server-side enforcement, a
// user who knows their temp password can hit ANY endpoint with full role
// privileges before changing it. This middleware closes that gap.
//
// Scope
// -----
// Mounted globally on /api. Skipped if no session.user (requireAuth handles
// unauthenticated). Skipped if must_change_password is falsy. Otherwise:
// - GET  /api/auth/me              → allowed (frontend status check)
// - POST /api/auth/change-password → allowed (the one action they can perform)
// - POST /api/auth/logout          → allowed (graceful exit)
// - everything else                → 403 with code MUST_CHANGE_PASSWORD
//
// Returns code so API consumers (mobile, scripts) can handle it the same way
// the web frontend does.

'use strict';

// Paths that remain accessible while flag is set. Any new exemption needs to
// be a path that does NOT mutate business state — only the password itself.
const ALLOWED_PATHS = new Set([
  '/auth/me',
  '/auth/change-password',
  '/auth/logout',
]);

function mustChangePasswordGuard(req, res, next) {
  const me = req.session?.user;
  if (!me) return next();                             // requireAuth handles
  if (!me.must_change_password) return next();        // not flagged

  // req.path is the path AFTER the /api mount (e.g. '/auth/change-password')
  if (ALLOWED_PATHS.has(req.path)) return next();

  return res.status(403).json({
    error: 'You must change your password before continuing.',
    code:  'MUST_CHANGE_PASSWORD',
  });
}

module.exports = { mustChangePasswordGuard };
