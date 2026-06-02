// tests/orphan-write-prevent.test.js
// Prevent-return guard for the orphan-write class of bugs (B25, B26, B27).
//
// The pattern that failed: a route file has multiple endpoints on the same
// :id parameter. Some use requireScopeFromEntity()/requireProjectScope()
// /requirePermission/firm-wide-only role gating; others on the same entity
// don't, and INSERT into a child table without verifying the caller has
// access to the parent's project.
//
// This test reads the route source (no DB), enumerates POST/PATCH/PUT
// routes, and asserts that any route which:
//   (a) accepts a :param that is NOT project_id, AND
//   (b) has an INSERT INTO in its handler body
// must include at least ONE of the recognised scope guards.
//
// Recognised guards:
//   - requireProjectScope (with explicit project extractor)
//   - requireScopeFromEntity('<table>', '<param>')
//   - requirePermission('<action>')   [grant matrix is firm-wide-only by convention]
//   - requirePrincipal | requirePMC   [firm-wide role gates]
//   - requireRole(...) where every role passed is firm-wide
//   - explicit me.projects.some(... === ...project_id) check in body
//   - PROJECT_SCOPED_ROLES check in body
//   - canCorrectTag / canTagPhotos / similar helpers
//
// New routes that don't fit any of these patterns will fail this test
// until they're explicitly added to the EXPECTED_SAFE list with justification.

'use strict';
const fs = require('fs');
const path = require('path');

const PROJECT_SCOPED_FIRM_WIDE_ROLES = new Set([
  // Firm-wide roles — when requireRole specifies ONLY these, no project-scope
  // check is needed (same convention as PROJECT_SCOPED_ROLES complement in
  // middleware/auth.js).
  'principal', 'design_principal', 'pmc_head', 'design_head', 'services_head',
  'finance_admin', 'audit', 'it_admin',
]);

function findAllRouteFiles(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) out.push(...findAllRouteFiles(path.join(dir, f.name)));
    else if (f.name.endsWith('.js') && !f.name.endsWith('.test.js')) out.push(path.join(dir, f.name));
  }
  return out;
}

function extractRoutes(src) {
  // Match `router.METHOD('PATH', ...args, asyncHandler/handler)`. We only need
  // path + method + the chunk up to the next `router.` (or EOF) for the body.
  const lines = src.split('\n');
  const routes = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/router\.(post|patch|put)\(\s*['"]([^'"]+)['"]/);
    if (!m) continue;
    // Capture body until the next router.X line OR end of file
    let body = lines[i];
    let depth = 0; let started = false;
    for (let j = i; j < lines.length; j++) {
      if (j > i) body += '\n' + lines[j];
      for (const c of lines[j]) {
        if (c === '(' || c === '{') { depth++; started = true; }
        else if (c === ')' || c === '}') depth--;
      }
      if (started && depth === 0 && j > i) { break; }
      if (j - i > 250) break;
    }
    routes.push({ method: m[1], path: m[2], line: i + 1, body });
  }
  return routes;
}

function hasPositiveGuard(route) {
  const b = route.body;

  // Pattern 1: requireProjectScope or requireScopeFromEntity middleware
  if (/requireProjectScope|requireScopeFromEntity/.test(b)) return true;

  // Pattern 2: requirePermission (matrix is firm-wide by current policy)
  if (/requirePermission\(/.test(b)) return true;

  // Pattern 3: requirePrincipal / requirePMC
  if (/\b(requirePrincipal|requirePMC)\b/.test(b)) return true;

  // Pattern 4: requireRole(...) where every role token is firm-wide
  const roleMatch = b.match(/requireRole\(([^)]+)\)/);
  if (roleMatch) {
    const inside = roleMatch[1];
    // Spread expansions like ...PRINCIPALS / ...PMC_ROLES — treat as firm-wide
    // (heuristic; both constants resolve to firm-wide-only sets).
    if (/\.\.\.(PRINCIPALS|PMC_ROLES|FIRM_WIDE)/.test(inside)) return true;
    // Quoted role names — split and check each is firm-wide
    const roles = [...inside.matchAll(/['"]([a-z_]+)['"]/g)].map(m => m[1]);
    if (roles.length > 0 && roles.every(r => PROJECT_SCOPED_FIRM_WIDE_ROLES.has(r))) return true;
  }

  // Pattern 5: explicit me.projects scope check in body
  if (/me\.projects/.test(b) && /PROJECT_SCOPE_DENIED|some\(p\s*=>/.test(b)) return true;

  // Pattern 6: PROJECT_SCOPED_ROLES check
  if (/PROJECT_SCOPED_ROLES/.test(b)) return true;

  // Pattern 7: known scope-checking helpers (canCorrectTag, canTagPhotos,
  // canApproveDrawing — these all internally check project membership)
  if (/\b(canCorrectTag|canTagPhotos|canApproveDrawing)\(/.test(b)) return true;

  return false;
}

function isCandidate(route) {
  // Has :something in path that is NOT project_id and isn't user-only
  if (!/:([a-z_]+)/.test(route.path)) return false;
  if (/:project_id\b|:projectId\b/.test(route.path)) return false;
  // Has INSERT INTO in body
  if (!/INSERT INTO\s+\w+/i.test(route.body)) return false;
  return true;
}

describe('orphan-write prevention — every INSERT route with :id has a project-scope gate', () => {
  const routeFiles = findAllRouteFiles(path.join(__dirname, '..', 'modules')).filter(
    f => /\/routes\//.test(f)
  );

  // Routes that legitimately don't fit any pattern — must justify each entry.
  // Add to this list ONLY after a careful review confirms the route is safe.
  const KNOWN_EXEMPT = new Set([
    // Vendor-public routes use token-as-auth; project scope is N/A (vendor is
    // unauthenticated, scope of action is the consumed token's vendor_id).
    'modules/onboarding/routes/vendor-public.js POST /:token/confirm',
    'modules/onboarding/routes/vendor-public.js POST /:token/reject',
  ]);

  const failures = [];
  for (const f of routeFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), f);
    for (const r of extractRoutes(src)) {
      if (!isCandidate(r)) continue;
      const key = `${rel} ${r.method.toUpperCase()} ${r.path}`;
      if (KNOWN_EXEMPT.has(key)) continue;
      if (!hasPositiveGuard(r)) {
        failures.push({ key, line: r.line });
      }
    }
  }

  test('no INSERT route is missing a project-scope gate', () => {
    if (failures.length > 0) {
      const lines = failures.map(f => `  ${f.key} (line ${f.line})`).join('\n');
      throw new Error(
        `${failures.length} INSERT route(s) without a recognised project-scope gate:\n\n${lines}\n\n` +
        `Each route must use one of: requireProjectScope, requireScopeFromEntity, requirePermission, ` +
        `requirePrincipal, requirePMC, requireRole(firm-wide-only), explicit me.projects check, ` +
        `or a known scope-helper (canCorrectTag, canApproveDrawing). ` +
        `If genuinely scope-free (e.g. vendor token endpoints), add to KNOWN_EXEMPT with justification.`
      );
    }
  });
});
