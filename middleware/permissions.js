// middleware/permissions.js — DB-backed role-permission middleware
//
// SINGLE SOURCE OF TRUTH: role_permissions DB table, populated from
// 01_Role_Permission_Matrix.xlsx via POST /api/governance/upload.
//
// If an action is queried that is NOT in the DB, can()/canWrite()/canApprove()
// return FALSE (deny). This is deliberate: the only way to grant a permission
// is to add the row to the sheet and upload it. There is no hidden hardcoded
// list to diverge from.
//
// If the DB table is empty or unreachable at startup, the middleware refuses
// to grant any permission (all checks return false). This fails loud — the app
// cannot run in a degraded "everyone allowed" mode.
//
// ─── WHEN TO USE requirePermission VS requireRole ───────────────────
// nu PMC has TWO authorisation mechanisms. They are complementary, NOT
// redundant. Pick the one that matches the gating concern:
//
//   requirePermission('namespace.action')     <-- THIS FILE
//     Use when: the role list for this action is debatable, may change as
//     the firm grows, or has been a governance-sheet decision in the past.
//     Examples: 'admin.vendor.update' (who can edit vendor master records?),
//     'onboarding.boq.upload' (who can upload BOQs?), 'finance.payment.approve'
//     (who can approve payments?). Principal edits Sheet 1 → grant changes
//     without redeploy.
//
//   requireRole('role1', 'role2', ...)        <-- middleware/auth.js
//   requireRole(...PRINCIPALS)                    (or other named role group)
//     Use when: the role list is definitionally fixed by the system.
//     Examples: requirePrincipal — only principals signoff on principal-tier
//     approvals (by definition); requireRole(...PMC_ROLES) — anything
//     PMC-internal. Role groups are defined in services/roles.js.
//
// COMMON CONFUSION (Concept-Map Audit, May 2026): looking at adjacent
// routes in the same file with different mechanisms is NOT drift — it's
// two DIFFERENT actions with appropriately different gating. Example
// from vendors.js:
//   POST /master                    requirePermission('admin.vendor.create')   // 6 roles
//   PATCH /master/:id/clear         requireRole('finance_admin','principal',
//                                                 'design_principal')          // 3 roles
//   PATCH /master/:id               requirePermission('admin.vendor.update')   // 6 roles
//   PATCH /master/:id/reject        requireRole('finance_admin','principal',
//                                                 'design_principal')          // 3 roles
// The /clear and /reject actions are FINANCE-OWNED post-creation steps —
// only finance + principals do them, narrowly fixed in code. The /create
// and /update actions are wider and Principal-editable via the sheet.
// ─────────────────────────────────────────────────────────────────────

'use strict';

const db = require('./db');

let _cache     = null;
let _actions   = null;
let _loadedAt  = null;
let _loadError = null;

async function _loadFromDB() {
  try {
    const [rows] = await db.query(
      'SELECT role, action, level FROM role_permissions'
    );
    if (!rows.length) {
      _loadError = 'role_permissions table is empty — upload Sheet 1 via /api/governance/upload';
      _cache = null; _actions = null;
      console.error('[permissions] ' + _loadError);
      return;
    }
    const map     = new Map();
    const actions = new Set();
    for (const { role, action, level } of rows) {
      map.set(`${role}::${action}`, level || '');
      actions.add(action);
    }
    _cache = map;
    _actions = actions;
    _loadedAt = new Date();
    _loadError = null;
    console.log(`[permissions] Loaded ${rows.length} rules covering ${actions.size} actions (${_loadedAt.toISOString()})`);
  } catch (err) {
    _cache = null; _actions = null;
    _loadError = err.message;
    console.error('[permissions] DB load error:', err.message);
  }
}

async function reloadPermissions() {
  _cache = null; _actions = null; _loadError = null;
  await _loadFromDB();
  return {
    loaded:  !!_cache,
    rules:   _cache ? _cache.size : 0,
    actions: _actions ? _actions.size : 0,
    error:   _loadError,
  };
}

async function _ensureLoaded() {
  if (_cache !== null) return;
  await _loadFromDB();
}

async function can(role, action) {
  await _ensureLoaded();
  if (!_cache) return false;
  const level = _cache.get(`${role}::${action}`);
  return !!level && level !== '';
}

async function canWrite(role, action) {
  await _ensureLoaded();
  if (!_cache) return false;
  return _cache.get(`${role}::${action}`) === 'W';
}

async function canApprove(role, action) {
  await _ensureLoaded();
  if (!_cache) return false;
  return _cache.get(`${role}::${action}`) === 'A';
}

function canSync(role, action) {
  if (!_cache) return false;
  const level = _cache.get(`${role}::${action}`);
  return !!level && level !== '';
}

function actionIsCovered(action) {
  return _actions ? _actions.has(action) : false;
}

function requirePermission(action) {
  return async (req, res, next) => {
    const me = req.session?.user;
    if (!me) return res.status(401).json({ error: 'Not authenticated' });

    await _ensureLoaded();
    if (!_cache) {
      return res.status(503).json({
        error: 'Permissions not loaded — upload governance sheet',
        code:  'PERMISSIONS_UNAVAILABLE',
        detail: _loadError,
      });
    }

    if (!_actions.has(action)) {
      console.warn(`[permissions] requirePermission('${action}') — action not in matrix; denying`);
    }

    const allowed = await can(me.role, action);
    if (!allowed) {
      return res.status(403).json({
        error:  'Not authorised',
        code:   'INSUFFICIENT_PERMISSIONS',
        action,
        role:   me.role,
      });
    }
    next();
  };
}

function getStatus() {
  return {
    source:   _cache ? 'database' : 'unloaded',
    rules:    _cache ? _cache.size : 0,
    actions:  _actions ? _actions.size : 0,
    loadedAt: _loadedAt,
    error:    _loadError,
  };
}

// Auto-load on module require — UNLESS we're under Jest, where tests seed
// the cache via _setCacheForTests to avoid stealing route mock responses.
if (typeof process.env.JEST_WORKER_ID === 'undefined') {
  _loadFromDB().catch(() => {});
}

// Test helper — seed the in-memory cache directly so unit tests don't need
// to mock the DB load. Pass an array of {role, action, level} rows.
function _setCacheForTests(rows) {
  const map = new Map(); const actions = new Set();
  for (const { role, action, level } of rows) {
    map.set(`${role}::${action}`, level || 'A');
    actions.add(action);
  }
  _cache = map; _actions = actions; _loadedAt = new Date(); _loadError = null;
}

module.exports = {
  can, canWrite, canApprove, canSync,
  requirePermission, reloadPermissions, getStatus,
  actionIsCovered,
  _setCacheForTests,
};
