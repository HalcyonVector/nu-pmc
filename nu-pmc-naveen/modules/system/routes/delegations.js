// routes/delegations.js
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const { resolveEffectiveRoles } = require('../../../middleware/delegation');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// Who can delegate to whom. Role → list of roles they're allowed to delegate to.
const DELEGATION_RULES = {
  // Principals can delegate to each other — handled as permanent seed, but also ad-hoc.
  principal:         ['design_principal','principal'],
  design_principal:  ['principal','design_principal'],
  // PMC Heads — peer, or limited-scope to their site managers.
  pmc_head:          ['pmc_head','site_manager'],   // site_manager only with limited_pmc scope
  // Design Head — detailing heads, peer services head.
  design_head:       ['detailing_head','team_lead','services_head','design_head'],
  // Services Head — services engineer, peer design head.
  services_head:     ['services_engineer','design_head','services_head'],
};

// GET /api/delegations — see delegations involving current user
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [fromMe] = await db.query(
      `SELECT * FROM delegations
       WHERE from_user_id = ? AND is_active = 1
       ORDER BY created_at DESC`,
      [me.id]
    );
    const [toMe] = await db.query(
      `SELECT * FROM delegations
       WHERE to_user_id = ?
         AND is_active = 1
         AND (end_at IS NULL OR end_at > NOW())
       ORDER BY created_at DESC`,
      [me.id]
    );
    const Onboarding = require('../../onboarding/contract');
    const projIds = [...fromMe.map(d => d.project_id), ...toMe.map(d => d.project_id)].filter(Boolean);
    const projs = await Onboarding.functions.getProjectsByIds(projIds);
    fromMe.forEach(d => { d.project_name = projs.get(d.project_id)?.name || null; });
    toMe.forEach(d   => { d.project_name = projs.get(d.project_id)?.name || null; });
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers([
      ...fromMe.map(d => d.to_user_id),
      ...toMe.map(d => d.from_user_id),
    ].filter(Boolean));
    fromMe.forEach(d => {
      const u = users.get(d.to_user_id);
      d.to_name = u?.full_name || null;
      d.to_role = u?.role || null;
    });
    toMe.forEach(d => {
      const u = users.get(d.from_user_id);
      d.from_name = u?.full_name || null;
      d.from_role = u?.role || null;
    });
    res.json({ delegations_from_me: fromMe, delegations_to_me: toMe });
  }));

// POST /api/delegations — create a new delegation
// Body: { to_user_id, project_id (or null for all), scope, end_at (or null for permanent — principals only), reason }
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { to_user_id, project_id, scope, end_at, reason } = req.body;

    if (!to_user_id) return res.status(400).json({ error: 'to_user_id required' });
    const [[toUser]] = await db.query('SELECT id, role, full_name FROM users WHERE id = ? AND is_active = 1', [to_user_id]);
    if (!toUser) return res.status(404).json({ error: 'Delegate not found or inactive' });

    // Check allowed delegate role for my role
    const allowed = DELEGATION_RULES[me.role] || [];
    if (!allowed.includes(toUser.role)) {
      return res.status(403).json({ error: `Users with role "${me.role}" cannot delegate to role "${toUser.role}"` });
    }

    // Scope rules
    let finalScope = scope || 'full';
    if (me.role === 'pmc_head' && toUser.role === 'site_manager') {
      finalScope = 'limited_pmc';  // forced — site manager can only get limited PMC powers
    }
    if (!['full','limited_pmc','photo_tags_only'].includes(finalScope)) {
      return res.status(400).json({ error: 'Invalid scope' });
    }

    // Permanent (end_at null) only allowed for principals delegating to each other
    let finalEnd = end_at || null;
    const isPrincipalPair = ['principal','design_principal'].includes(me.role) && ['principal','design_principal'].includes(toUser.role);
    if (finalEnd === null && !isPrincipalPair) {
      return res.status(400).json({ error: 'Non-principal delegations must have an end date' });
    }

    // Project-scoped required for design/services heads
    if (['design_head','services_head'].includes(me.role) && !project_id) {
      return res.status(400).json({ error: 'Design/Services Heads must delegate per project. Select a project.' });
    }

    // If site manager is the delegate, ensure they're actually assigned to this project
    if (toUser.role === 'site_manager') {
      if (!project_id) return res.status(400).json({ error: 'Site Manager delegations must specify the project' });
      const [[assigned]] = await db.query(
        'SELECT 1 FROM project_assignments WHERE project_id = ? AND user_id = ? AND is_active = 1',
        [project_id, toUser.id]
      );
      if (!assigned) return res.status(400).json({ error: 'Site Manager is not assigned to this project' });
    }

    const [result] = await db.query(
      `INSERT INTO delegations
         (from_user_id, to_user_id, project_id, scope, start_at, end_at, reason, created_by)
       VALUES (?,?,?,?, NOW(), ?, ?, ?)`,
      [me.id, toUser.id, project_id || null, finalScope, finalEnd, reason || null, me.id]
    );

    res.json({
      success: true,
      id: result.insertId,
      message: `Delegated to ${toUser.full_name} — ${finalScope} scope${project_id ? ' on this project' : ' across all projects'}${finalEnd ? ' until ' + new Date(finalEnd).toLocaleDateString('en-IN') : ' (permanent)'}.`
    });
  }));

// POST /api/delegations/:id/revoke — revoke a delegation early
router.post('/:id/revoke', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [[d]] = await db.query('SELECT * FROM delegations WHERE id = ?', [req.params.id]);
    if (!d) return res.status(404).json({ error: 'Delegation not found' });

    const isPrincipal = ['principal','design_principal'].includes(me.role);
    const isOwner     = d.from_user_id === me.id || d.to_user_id === me.id;
    if (!isPrincipal && !isOwner) return res.status(403).json({ error: 'Not authorised to revoke this delegation' });

    await db.query(
      'UPDATE delegations SET is_active = 0, revoked_at = NOW(), revoked_by = ? WHERE id = ?',
      [me.id, req.params.id]
    );
    res.json({ success: true });
  }));

// GET /api/delegations/effective — see what roles I'm currently effectively holding
router.get('/effective', requireAuth, asyncHandler(async (req, res) => {
    const { project_id } = req.query;
    const effective = await resolveEffectiveRoles(req.session.user, project_id || null);
    res.json({ effective });
  }));

// GET /api/delegations/delegable-users — list users I'm allowed to delegate to
router.get('/delegable-users', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const allowedRoles = DELEGATION_RULES[me.role] || [];
    if (!allowedRoles.length) return res.json({ users: [] });

    const placeholders = allowedRoles.map(() => '?').join(',');
    const [users] = await db.query(
      `SELECT id, username, full_name, role FROM users
       WHERE role IN (${placeholders}) AND id != ? AND is_active = 1
       ORDER BY full_name`,
      [...allowedRoles, me.id]
    );
    res.json({ users });
  }));

module.exports = router;
