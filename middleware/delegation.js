// middleware/delegation.js
// ===========================================================
// Resolves effective roles for a user given active delegations.
// Every route that does a role-based check should use resolveEffectiveRoles()
// instead of reading session.user.role directly, so delegations are honoured.
//
// Model:
//  - A user's own role always applies.
//  - Every active delegation WHERE to_user_id = me grants me the role
//    of from_user_id for the specified project (or all projects if NULL).
//  - Permanent delegations (end_at IS NULL) run forever until revoked.
//  - Time-bounded delegations auto-expire; is_active is updated by a cron.
//
// Scopes:
//  - 'full'            — take on the delegator's full role
//  - 'limited_pmc'     — operational PMC only; no governance approvals
//  - 'photo_tags_only' — can only adjust photo tags
// ===========================================================

const db = require('./db');

// Return all currently-valid delegations where `toUserId` is the acting party.
async function getActiveDelegationsFor(toUserId) {
  const [rows] = await db.query(
    `SELECT d.*, uf.role AS from_role, uf.full_name AS from_name
     FROM delegations d
     JOIN users uf ON d.from_user_id = uf.id
     WHERE d.to_user_id = ?
       AND d.is_active = 1
       AND (d.end_at IS NULL OR d.end_at > NOW())
       AND d.start_at <= NOW()`,
    [toUserId]
  );
  return rows;
}

// Given the user and optional project context, return all roles they can act as,
// plus metadata about which are delegated (so UI can show "Acting for X" tags).
async function resolveEffectiveRoles(user, projectId = null) {
  const effective = [{
    role:       user.role,
    from_user:  user.id,
    from_name:  user.full_name,
    via:        'self',
    scope:      'full',
    project_id: null,
  }];

  const delegs = await getActiveDelegationsFor(user.id);
  for (const d of delegs) {
    // App-wide delegation (project_id NULL) always applies.
    // Project-scoped delegation applies only when acting inside that project.
    if (d.project_id !== null && projectId !== null && Number(d.project_id) !== Number(projectId)) continue;

    effective.push({
      role:       d.from_role,
      from_user:  d.from_user_id,
      from_name:  d.from_name,
      via:        'delegation',
      scope:      d.scope,
      project_id: d.project_id,
      delegation_id: d.id,
    });
  }
  return effective;
}

// Quick check used by route guards — does `user` currently hold any of the listed roles,
// either natively or via delegation?
async function hasEffectiveRole(user, allowedRoles, projectId = null) {
  const eff = await resolveEffectiveRoles(user, projectId);
  for (const e of eff) {
    if (!allowedRoles.includes(e.role)) continue;
    // 'limited_pmc' scope excludes governance actions — route-level check if needed
    // 'photo_tags_only' excluded here; routes handle photo tagging separately
    if (e.scope === 'photo_tags_only') continue;
    return { allowed: true, via: e };
  }
  return { allowed: false };
}

// Permissive variant used by photo-tag routes — accepts photo_tags_only scope too
async function canTagPhotos(user, projectId = null) {
  const eff = await resolveEffectiveRoles(user, projectId);
  const streamRoles = ['design_head','services_head','team_lead','team_lead','jr_architect','jr_engineer','services_engineer'];
  const managerRoles= ['principal','design_principal','pmc_head','site_manager'];
  for (const e of eff) {
    if (streamRoles.includes(e.role) || managerRoles.includes(e.role)) return { allowed: true, via: e };
  }
  return { allowed: false };
}

// Guard for any action that is explicitly BLOCKED for limited_pmc delegations.
// Use in routes that represent governance actions (schedule approval, CN approval,
// weekly report sign-off, team access changes).
async function requireGovernanceAuthority(user, allowedRoles, projectId = null) {
  const eff = await resolveEffectiveRoles(user, projectId);
  for (const e of eff) {
    if (!allowedRoles.includes(e.role)) continue;
    if (e.scope === 'limited_pmc') continue;      // site manager acting as PMC — blocked
    if (e.scope === 'photo_tags_only') continue;  // photo-tag delegate — blocked
    return { allowed: true, via: e };
  }
  return { allowed: false };
}

module.exports = {
  getActiveDelegationsFor,
  resolveEffectiveRoles,
  hasEffectiveRole,
  canTagPhotos,
  requireGovernanceAuthority,
};
