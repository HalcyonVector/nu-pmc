// middleware/auth.js — Session-based auth + role checks

// ── AUDIT ROLE ────────────────────────────────────────────────
// 'audit' is a read-only test account that bypasses every role gate on GET
// requests but is rejected on any write. The rejection happens in two places:
//   1. Role gates (requireRole, requirePMC, ...) bypass for audit on GET only
//   2. Global /api middleware blockAuditWrites (mounted in server.js) catches
//      any non-GET request by an audit session that got past an endpoint with
//      only requireAuth (i.e. no explicit role gate).
// Login and logout are allowed through blockAuditWrites so the audit user can
// start and end their session.
function isAuditGet(req) {
  return req.session?.user?.role === 'audit' && req.method === 'GET';
}

// ── PROJECT-SCOPED ROLES ──────────────────────────────────────
// These roles see only projects they are assigned to via project_assignments.
// All other roles (principal, design_principal, pmc_head, design_head,
// services_head, finance_admin, audit) see every project firm-wide.
// detailing_head is here until merged into team_lead (Sprint 2 nav redesign).
const PROJECT_SCOPED_ROLES = [
  'site_manager',
  'senior_site_manager',
  'team_lead',
  'detailing_head',
  'jr_architect',
  'services_engineer',
  'coordinator',
  'detailing',
  'trainee',
];

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (isAuditGet(req)) return next();
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Principals — Naveen or Ajay
function requirePrincipal(req, res, next) {
  const principals = ['principal', 'design_principal'];
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  if (isAuditGet(req)) return next();
  if (!principals.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Principal access required' });
  }
  next();
}

// PMC Head or Principal
function requirePMC(req, res, next) {
  const allowed = ['principal', 'design_principal', 'pmc_head'];
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  if (isAuditGet(req)) return next();
  if (!allowed.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'PMC access required' });
  }
  next();
}

// Design stream access
function requireDesign(req, res, next) {
  const allowed = ['principal', 'design_principal', 'design_head', 'detailing_head', 'team_lead', 'jr_architect', 'detailing'];
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  if (isAuditGet(req)) return next();
  if (!allowed.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Design team access required' });
  }
  next();
}

// Services stream access
function requireServices(req, res, next) {
  const allowed = ['principal', 'design_principal', 'services_head', 'services_engineer'];
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  if (isAuditGet(req)) return next();
  if (!allowed.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Services team access required' });
  }
  next();
}

// Check if user can approve drawings (stream-aware)
function canApproveDrawing(user, drawing) {
  if (user.role === 'audit') return false;          // Audit never performs actions
  if (['principal', 'design_principal'].includes(user.role)) return true;
  // Design stream — two-step: detailing_head/team_lead at L1, design_head at L2
  if ((user.role === 'detailing_head' || user.role === 'team_lead') && drawing.stream === 'design' && drawing.status === 'pending_l1') return true;
  if (user.role === 'design_head' && drawing.stream === 'design' && drawing.status === 'pending_l2') return true;
  // Services stream — no detailing equivalent; services_head approves at both levels
  if (user.role === 'services_head' && drawing.stream === 'services') return true;
  return false;
}

function canFlagDrawing(user, drawing) {
  if (user.role === 'audit') return false;
  if (['principal', 'design_principal'].includes(user.role)) return true;
  if (user.role === 'design_head' && drawing.stream === 'design') return true;
  if (user.role === 'services_head' && drawing.stream === 'services') return true;
  if (user.role === 'pmc_head') return true;
  return false;
}

function canApproveSchedule(user, _driftDays) {
  if (user.role === 'audit') return false;
  return user.role === 'principal';
}

const requireFinance = (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  if (isAuditGet(req)) return next();
  // Keep in sync with FINANCE_ROLES in services/roles.js.
  // PMC head sees/acts on finance items (weekly batches, PR approvals, GSTR review).
  const allowed = ['principal','design_principal','pmc_head','finance_admin'];
  if (!allowed.includes(req.session.user.role)) return res.status(403).json({ error: 'Finance access required' });
  next();
};

// Global /api guard — blocks non-GET methods for audit users.
// Mount in server.js after session setup, before routes.
// Exceptions: logout must work so audit can end their session cleanly.
function blockAuditWrites(req, res, next) {
  if (req.session?.user?.role !== 'audit') return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.path === '/auth/logout') return next();
  return res.status(403).json({ error: 'Read-only audit account — cannot edit', code: 'AUDIT_READ_ONLY' });
}

// ── PROJECT SCOPE ENFORCEMENT (L4a fix) ────────────────────────────────────
// Middleware to enforce that project-scoped users can only touch projects
// they are assigned to. Firm-wide roles (principal, DP, PMC head, design/
// services head, finance, audit, it_admin) pass through.
// ════════════════════════════════════════════════════════════════════════════
// CLOSED-PROJECT WRITE GUARD
// ────────────────────────────────────────────────────────────────────────────
// Once all four closure signoffs arrive (pmc_head, design_head, services_head,
// principal), projects.status flips from 'active' to 'completed'. Past that
// point, no writes are permitted on the project — only reads.
//
// The check runs inside requireProjectScope() and requireScopeFromEntity()
// because those are the two middlewares that actually know which project a
// request is about. Hooking globally on /api would mean re-deriving project_id
// from path patterns, which is fragile.
//
// To enforce closure on a NEW project-scoped route, just use one of those two
// middlewares — the guard is automatic.
//
// Bypass paths: GET requests always pass. There's no env var kill switch
// because once a project is closed, "let writes through anyway" is the wrong
// answer in every case.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Returns a 403 response if the project is completed AND the request is a write.
 * Returns null otherwise (caller should continue).
 */
function blockIfProjectClosed(req, res, projectStatus) {
  if (projectStatus === 'completed' && req.method !== 'GET') {
    res.status(403).json({
      error: 'Project is closed. Writes are not permitted on completed projects.',
      code:  'PROJECT_CLOSED',
    });
    return true;
  }
  return false;
}

//
// Reads the project_id from req.params.project_id by default. Pass a custom
// extractor as `getProjectId` for endpoints that name the param differently
// or derive it from another table.
//
// Usage:
//   router.get('/:project_id', requireAuth, requireProjectScope(), handler);
//   router.post('/', requireAuth, requireProjectScope(req => req.body.project_id), handler);
function requireProjectScope(getProjectId) {
  const extract = typeof getProjectId === 'function'
    ? getProjectId
    : (req) => req.params.project_id;

  return async (req, res, next) => {
    const me = req.session?.user;
    if (!me) return res.status(401).json({ error: 'Not authenticated' });

    const pid = parseInt(extract(req), 10);

    // Firm-wide roles — no scope check, but still enforce closed-project guard.
    if (!PROJECT_SCOPED_ROLES.includes(me.role)) {
      if (pid) {
        try {
          const db = require('../../../middleware/db');
          const [[p]] = await db.query('SELECT status FROM projects WHERE id = ?', [pid]);
          if (p) {
            req._projectId = pid; req._projectStatus = p.status;
            if (blockIfProjectClosed(req, res, p.status)) return;
          }
        } catch (err) {
          // Fail-closed on writes: if we cannot verify project status, we
          // cannot guarantee the project is still open — refuse the write.
          // GETs proceed (stale-read is a smaller harm than blocking all reads
          // during a transient DB hiccup).
          console.error('[requireProjectScope] status fetch failed:', err.message);
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            return res.status(503).json({
              error: 'Could not verify project status. Try again.',
              code:  'PROJECT_STATUS_UNAVAILABLE',
            });
          }
        }
      }
      return next();
    }

    if (!pid) {
      return res.status(400).json({ error: 'project_id required' });
    }

    // Bug 24: refresh the session-cached project list if it is older than
    // PROJECT_CACHE_TTL_MS (5 min). Without this, a user removed from a
    // project mid-session retains access until logout. Uses the same
    // loadProjectsForUser helper as login + /refresh-projects so all three
    // paths produce identical project lists.
    const PROJECT_CACHE_TTL_MS = 5 * 60 * 1000;
    const cacheAge = me.projects_at ? Date.now() - me.projects_at : Infinity;
    if (cacheAge > PROJECT_CACHE_TTL_MS) {
      try {
        const { loadProjectsForUser } = require('../routes/auth');
        me.projects = await loadProjectsForUser(me);
        me.projects_at = Date.now();
      } catch (err) {
        // Stale cache is preferable to a hard failure here. Log and continue
        // with whatever projects list we already had — the worst case is one
        // request served against slightly-old data, no security harm.
        console.error('[requireProjectScope] project list refresh failed:', err.message);
      }
    }

    // user.projects is populated at login and refreshed on a 5-min TTL above.
    const assigned = (me.projects || []).some(p => parseInt(p.id) === pid);
    if (!assigned) {
      return res.status(403).json({
        error: 'Not assigned to this project',
        code:  'PROJECT_SCOPE_DENIED',
      });
    }

    // Stash project status + enforce closed-project block.
    try {
      const db = require('../../../middleware/db');
      const [[p]] = await db.query('SELECT status FROM projects WHERE id = ?', [pid]);
      if (p) {
        req._projectId = pid; req._projectStatus = p.status;
        if (blockIfProjectClosed(req, res, p.status)) return;
      }
    } catch (err) {
      // Fail-closed on writes (see comment above).
      console.error('[requireProjectScope] status fetch failed:', err.message);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(503).json({
          error: 'Could not verify project status. Try again.',
          code:  'PROJECT_STATUS_UNAVAILABLE',
        });
      }
    }

    next();
  };
}

// Variant that checks scope based on a SQL lookup — for endpoints that
// take an entity ID and you need to derive project_id from it.
// Example: PATCH /api/issues/:id/resolve — we look up issues.project_id
// from the given :id first, then enforce scope.
//
// Usage:
//   router.patch('/:id/resolve', requireAuth,
//     requireScopeFromEntity('issues', 'id'), handler);
function requireScopeFromEntity(table, idParam = 'id') {
  return async (req, res, next) => {
    const me = req.session?.user;
    if (!me) return res.status(401).json({ error: 'Not authenticated' });

    const id = parseInt(req.params[idParam], 10);
    if (!id) return res.status(400).json({ error: `${idParam} required` });

    // Narrow try/catch around ONLY the DB lookup. Don't wrap the rest of
    // the middleware (next() in particular) — otherwise downstream route
    // errors get masked as "scope check failed".
    let row;
    try {
      const db = require('../../../middleware/db');
      const [[r]] = await db.query(
        `SELECT e.project_id, p.status
         FROM \`${table}\` e LEFT JOIN projects p ON e.project_id = p.id
         WHERE e.id = ?`, [id]
      );
      row = r;
    } catch (err) {
      console.error('[requireScopeFromEntity] DB lookup failed:', err.message);
      // Fail-closed on writes; allow GETs through (stale-read is the lesser
      // harm during a DB hiccup). Match requireProjectScope semantics.
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(503).json({
          error: 'Could not verify project status. Try again.',
          code:  'PROJECT_STATUS_UNAVAILABLE',
        });
      }
      return next();
    }

    if (!row) return res.status(404).json({ error: 'Record not found' });
    const pid = parseInt(row.project_id);

    req._projectId = pid;
    req._projectStatus = row.status;

    // Closed-project write block (applies to all roles, including firm-wide).
    if (blockIfProjectClosed(req, res, row.status)) return;

    // Firm-wide roles bypass the assignment check (but still got the closure check above).
    if (!PROJECT_SCOPED_ROLES.includes(me.role)) return next();

    const assigned = (me.projects || []).some(p => parseInt(p.id) === pid);
    if (!assigned) {
      return res.status(403).json({
        error: 'Not assigned to this project',
        code:  'PROJECT_SCOPE_DENIED',
      });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requirePrincipal,
  requirePMC,
  requireDesign,
  requireServices,
  canFlagDrawing,
  canApproveDrawing,
  canApproveSchedule,
  requireFinance,
  blockAuditWrites,
  isAuditGet,
  PROJECT_SCOPED_ROLES,
  requireProjectScope,
  requireScopeFromEntity,
  blockIfProjectClosed,
};
