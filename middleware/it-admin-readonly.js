// middleware/it-admin-readonly.js
//
// it_admin is the IT support role. They can VIEW everything to diagnose
// issues, but they cannot WRITE to project data — drawings, schedules,
// payments, BOQ, weekly reports, etc.
//
// What it_admin CAN write to (system-level only):
//   - /auth (password reset, change-password)
//   - /admin-reset (reset another user's password)
//   - /users (create/edit/deactivate users — IT plumbing)
//   - /system (system config endpoints — feature flags, etc.)
//   - /governance (governance sheet management)
//
// Anything else: GET allowed, write blocked with 403.
//
// Mounted at /api in server.js, so req.path comes in WITHOUT the /api prefix.
// Paths here are therefore '/payments' not '/api/payments'.

const IT_ADMIN_WRITE_ALLOWED = [
  '/auth',                  // password ops
  '/admin-reset',           // reset other user's password (IT support)
  '/users',                 // user management — create, edit, deactivate
  '/user-management',       // user pending approvals workflow
  '/system',                // system config endpoints
  '/governance',            // governance sheet management
  '/nav-admin',             // nav editor
  '/log/client-error',      // client-error reporting (anyone can POST)
];

function itAdminReadonly(req, res, next) {
  const user = req.session?.user;
  if (!user || user.role !== 'it_admin') return next();

  // Read-only: GET passes through unconditionally
  if (req.method === 'GET') return next();

  // Write paths: only the explicit allowlist
  const isAllowed = IT_ADMIN_WRITE_ALLOWED.some(p => req.path.startsWith(p));
  if (isAllowed) return next();

  return res.status(403).json({
    error: 'IT Admin is read-only on project data. Edits must be done by the role that owns the workflow.',
    code:  'IT_ADMIN_READ_ONLY',
  });
}

module.exports = { itAdminReadonly };
