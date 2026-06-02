# M1 — Auth Module

## What it does
Handles authentication (login, logout, session), user identity, role/permission gates, and user management (create, list, deactivate).

## Depends on
- `/middleware/db.js`     — database connection (shared)
- `/middleware/asyncHandler.js` — (shared)
- `/middleware/validate.js` — (shared)
- `/middleware/upload.js`  — (shared, used by user-management for bulk Excel upload)
- `/services/audit.js`    — audit logging (shared)
- `/services/whatsapp.js` — OTP delivery (shared)
- `/services/notifications.js` — (shared)
- `/services/password-policy.js` — (shared)
- `/services/users-lookup.js` — (shared) — will migrate into M1 over time

## Tables owned
`users`, `user_pending`, `password_reset_otps`.

Other modules may SELECT these through the contract; they must never INSERT or UPDATE.

## Public API
See `contract.js`. Callers use:
```js
const Auth = require('../../modules/auth/contract');
router.get('/foo', Auth.middleware.requireAuth, handler);
const team = await Auth.functions.getUsersByRole('design_head', projectId);
```

## Route mounts (server.js)
```js
app.use('/api/auth',           require('./modules/auth/contract').routes.auth);
app.use('/api/users',          require('./modules/auth/contract').routes.users);
app.use('/api/user-management',require('./modules/auth/contract').routes.userManagement);
app.use('/api/admin-reset',    require('./modules/auth/contract').routes.adminReset);
```
(Currently still mounted via direct `require('./modules/auth/routes/...')` in server.js — to be migrated to contract-based mount in a later pass.)

## Backward-compat shim
`/middleware/auth.js` is a re-export shim pointing at `./modules/auth/middleware/auth.js`.
58 legacy route files still import from `../middleware/auth`. The shim keeps them working until they migrate to importing from their own module's contract.

## Tests
See `tests/` — to be added in V5.1 step.

## Gate status
- [x] Files physically moved (5 files into `/modules/auth/`)
- [x] Internal require paths rewritten
- [x] Syntax check passes (7 files)
- [x] Runtime require passes (6 files)
- [x] Shim keeps 53 legacy routes working (53/53 load)
- [x] Server boots cleanly with new layout
- [x] Login works end-to-end (HTTP 200, session established)
- [x] `/api/auth/me` returns correct user after login
- [x] `/api/users` returns user list via middleware shim
- [ ] Unit/integration tests added — DEFERRED to V5 test pass
- [ ] Boundary enforcement (other modules can't reach past contract) — DEFERRED to lint rule step
