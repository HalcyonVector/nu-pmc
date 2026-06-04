// routes/projects.js
const express  = require('express');
const db       = require('../../../middleware/db');
const { requireAuth, requirePrincipal, requirePMC, PROJECT_SCOPED_ROLES, requireProjectScope } = require('../../../middleware/auth');
const { validators } = require('../../../middleware/validate');
const notif   = require('../../../services/notifications');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router   = express.Router();

// GET /api/projects — list projects visible to this user
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    let rows;

    if (me.role === 'it_admin') {
      // IT Admin has no project context/visibility
      rows = [];
    } else if (PROJECT_SCOPED_ROLES.includes(me.role)) {
      // Project-scoped roles see only projects they are assigned to,
      // and only those still active. Bug B1: previously this query
      // showed completed projects too, mirroring the session-cache leak
      // fixed at login (Bug 6). The list endpoint must apply the same
      // filter.
      [rows] = await db.query(
        `SELECT p.* FROM projects p
         JOIN project_assignments pa ON pa.project_id = p.id
         WHERE pa.user_id = ? AND pa.is_active = 1
           AND p.status != 'completed'`,
        [me.id]
      );
    } else {
      // Firm-wide roles (principals, heads, finance, audit) see all projects
      [rows] = await db.query('SELECT * FROM projects ORDER BY status, name');
    }

    if (rows.length > 0) {
      const pids = rows.map(p => p.id);

      // 1. Fetch issue counts (open & overdue)
      const [issueRows] = await db.query(
        `SELECT project_id, 
                SUM(CASE WHEN status != 'closed' THEN 1 ELSE 0 END) AS open_queries,
                SUM(CASE WHEN status != 'closed' AND is_overdue = 1 THEN 1 ELSE 0 END) AS overdue_queries
         FROM issues 
         WHERE project_id IN (?)
         GROUP BY project_id`,
        [pids]
      );
      const issuesMap = new Map(issueRows.map(r => [r.project_id, r]));

      // 2. Fetch flagged task counts
      const [flaggedRows] = await db.query(
        `SELECT project_id, COUNT(*) AS flagged_tasks
         FROM task_updates 
         WHERE project_id IN (?) AND is_flagged = 1
         GROUP BY project_id`,
        [pids]
      );
      const flaggedMap = new Map(flaggedRows.map(r => [r.project_id, r.flagged_tasks]));

      // 3. Fetch overdue material requests
      const [overdueMaterialRows] = await db.query(
        `SELECT project_id, COUNT(*) AS overdue_materials
         FROM material_requests 
         WHERE project_id IN (?) AND is_overdue = 1
         GROUP BY project_id`,
        [pids]
      );
      const overdueMaterialsMap = new Map(overdueMaterialRows.map(r => [r.project_id, r.overdue_materials]));

      // 4. Fetch schedule versions
      const [schedRows] = await db.query(
        `SELECT project_id, end_date, drift_days, label AS current_version
         FROM schedule_versions
         WHERE project_id IN (?) AND is_current = 1`,
        [pids]
      );
      const schedMap = new Map(schedRows.map(r => [r.project_id, r]));

      // 5. Fetch avg task completion (overall progress)
      const [avgRows] = await db.query(
        `SELECT st.project_id, COALESCE(AVG(latest_pct.pct), 0) AS avg_pct_complete
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
         LEFT JOIN (
           SELECT tu1.task_id, tu1.pct_complete AS pct
           FROM task_updates tu1
           WHERE tu1.id = (
             SELECT MAX(tu2.id) FROM task_updates tu2 WHERE tu2.task_id = tu1.task_id
           )
         ) latest_pct ON latest_pct.task_id = st.id
         WHERE sv.project_id IN (?)
         GROUP BY st.project_id`,
        [pids]
      );
      const avgMap = new Map(avgRows.map(r => [r.project_id, r.avg_pct_complete]));

      // 6. Fetch per-trade progress
      const [tradeRows] = await db.query(
        `SELECT st.project_id, st.trade, AVG(tu.pct_complete) AS avg_pct
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
         LEFT JOIN task_updates tu ON tu.task_id = st.id
         WHERE st.project_id IN (?)
         GROUP BY st.project_id, st.trade`,
        [pids]
      );
      const tradesMap = new Map();
      for (const r of tradeRows) {
        if (!tradesMap.has(r.project_id)) {
          tradesMap.set(r.project_id, {});
        }
        if (r.trade) {
          tradesMap.get(r.project_id)[r.trade] = Number(r.avg_pct) || 0;
        }
      }

      // Map everything back onto the projects
      for (const p of rows) {
        const issues = issuesMap.get(p.id) || { open_queries: 0, overdue_queries: 0 };
        p.stats = {
          open_queries:      issues.open_queries || 0,
          overdue_queries:   issues.overdue_queries || 0,
          flagged_tasks:     flaggedMap.get(p.id) || 0,
          overdue_materials: overdueMaterialsMap.get(p.id) || 0,
        };

        const sched = schedMap.get(p.id);
        p.schedule = sched ? {
          end_date: sched.end_date,
          drift_days: sched.drift_days,
          current_version: sched.current_version
        } : null;

        const avgPctComplete = avgMap.get(p.id) || 0;
        p.avg_pct = Math.round(parseFloat(avgPctComplete));

        p.trades = tradesMap.get(p.id) || {};
      }
    }

    res.json({ projects: rows });

  }));

// GET /api/projects/:id — single project detail
router.get('/:id', requireAuth, requireProjectScope(req => req.params.id), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const pid = req.params.id;
    const [[project]] = await db.query('SELECT * FROM projects WHERE id = ?', [pid]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Role-aware Project Summary block (Sprint 3 Item 11)
    const summary = await buildProjectSummary(me, parseInt(pid, 10));
    res.json({ project, summary });
  }));

// ────────────────────────────────────────────────────────────────────────
// Project Summary helper — role-aware button list + counts
// ────────────────────────────────────────────────────────────────────────
// Per the Role × Button matrix (see 20260420 nu ProjectSummary Audit v2.xlsx,
// sheet "Role × Button"). Each role sees a different subset of buttons on
// Project Summary, with counts computed live.
//
// The Issues button's LABEL varies per role (backend returns the right label):
//   - principal/design_principal/pmc_head/audit   → "Issues"      (all open)
//   - site_manager/senior_site_manager            → "Project Issues" (all open)
//   - design_head                                 → "Issues"      (design-related types)
//   - services_head                               → "Issues"      (services-related types)
//   - team_lead/jr_architect/services_engineer/
//     coordinator                                 → "My Issues"   (assigned_to = me)
//
// The Approvals button opens a 5-category strip on the frontend — the
// `approvals_categories` array returned here gives per-category counts for
// the categories this role can see, auto-filtered to what they can action.
async function buildProjectSummary(me, projectId) {
  const role = me.role;

  // Role → button keys. Detailing + trainee have no project_detail tab at all,
  // handled in nav config, but we return an empty list defensively.
  const BUTTONS_BY_ROLE = {
    principal:           ['schedule', 'issues', 'cns', 'approvals'],
    design_principal:    ['schedule', 'issues', 'cns', 'approvals'],
    pmc_head:            ['issues', 'cns', 'approvals', 'reports'],
    design_head:         ['issues', 'approvals'],
    services_head:       ['issues', 'approvals'],
    finance_admin:       ['payments_queue'],
    senior_site_manager: ['schedule', 'issues', 'approvals'],
    site_manager:        ['schedule', 'issues', 'approvals'],
    team_lead:           ['issues', 'submittals'],
    detailing_head:      ['issues', 'submittals'],   // legacy, merged into team_lead
    jr_architect:        ['issues'],
    services_engineer:   ['issues'],
    coordinator:         ['issues', 'todays_tasks'],
    audit:               ['schedule', 'issues', 'cns', 'approvals', 'reports'],
    it_admin:            [],   // IT admin has no project context
    detailing:           [],
    trainee:             [],
  };
  const visibleButtons = BUTTONS_BY_ROLE[role] || [];

  // Issues label varies per role.
  const ISSUES_LABEL = {
    principal:'Issues', design_principal:'Issues', pmc_head:'Issues', audit:'Issues',
    design_head:'Issues', services_head:'Issues',
    site_manager:'Project Issues', senior_site_manager:'Project Issues',
    team_lead:'My Issues', detailing_head:'My Issues',
    jr_architect:'My Issues', services_engineer:'My Issues', coordinator:'My Issues',
  };

  // ── Issues count (role-filtered)
  async function countIssues() {
    if (['jr_architect','services_engineer','team_lead','detailing_head','coordinator'].includes(role)) {
      const [[r]] = await db.query(
        `SELECT COUNT(*) c FROM issues
          WHERE project_id=? AND assigned_to=? AND status IN ('open','in_progress')`,
        [projectId, me.id]
      );
      return r.c;
    }
    if (role === 'design_head') {
      const [[r]] = await db.query(
        `SELECT COUNT(*) c FROM issues
          WHERE project_id=? AND issue_type IN ('design','rfi') AND status IN ('open','in_progress')`,
        [projectId]
      );
      return r.c;
    }
    if (role === 'services_head') {
      const [[r]] = await db.query(
        `SELECT COUNT(*) c FROM issues
          WHERE project_id=? AND issue_type IN ('rfi') AND status IN ('open','in_progress')`,
        [projectId]
      );
      return r.c;
    }
    // principal/design_principal/pmc_head/site_manager/senior_site/audit → all open
    const [[r]] = await db.query(
      `SELECT COUNT(*) c FROM issues
        WHERE project_id=? AND status IN ('open','in_progress')`,
      [projectId]
    );
    return r.c;
  }

  // ── CNs count
  async function countCNs() {
    const [[r]] = await db.query(
      `SELECT COUNT(*) c FROM change_notices
        WHERE project_id=? AND status IN ('collecting_sigs','pending_approval')`,
      [projectId]
    );
    return r.c;
  }

  // ── Reports count (daily reports pending review, PMC-specific)
  async function countReports() {
    const [[r]] = await db.query(
      `SELECT COUNT(*) c FROM daily_reports
        WHERE project_id=? AND status='pending_review'
          AND NOW() < TIMESTAMPADD(DAY, 2, report_date)`,
      [projectId]
    );
    return r.c;
  }

  // ── Submittals count (team_lead / detailing_head — submittals returned)
  async function countSubmittals() {
    const [[r]] = await db.query(
      `SELECT COUNT(*) c FROM submittals
        WHERE project_id=? AND status='resubmit_required'`,
      [projectId]
    );
    return r.c;
  }

  // ── Payments Queue count (finance_admin — pending PRs across project)
  async function countPaymentsQueue() {
    const [[r]] = await db.query(
      `SELECT COUNT(*) c FROM payment_requests
        WHERE project_id=? AND status IN ('pending_pmc','pending_principal','pmc_approved','principal_approved')`,
      [projectId]
    );
    return r.c;
  }

  // ── Today's Tasks count (coordinator — tasks due today or overdue)
  async function countTodaysTasks() {
    const [[r]] = await db.query(
      `SELECT COUNT(*) c FROM schedule_tasks st
         JOIN schedule_versions sv ON sv.id=st.schedule_version_id AND sv.is_current=1
        WHERE st.project_id=? AND st.end_date <= CURDATE()`,
      [projectId]
    );
    return r.c;
  }

  // ── Approvals sub-categories (filtered by role)
  async function approvalsCategories() {
    const cats = [];

    // 1. Drawings category — drawing_versions pending + submittals under review
    //    + CNs pending approval (role-scoped)
    const allowsDrawingsCat = ['principal','design_principal','pmc_head','design_head','services_head','audit'].includes(role);
    if (allowsDrawingsCat) {
      const DS = require('../../design-services/contract');
      let stream = null;
      if (role === 'design_head')   stream = 'design';
      if (role === 'services_head') stream = 'services';
      const drCount = await DS.functions.countDrawingVersions(projectId, ['pending_l1','pending_l2'], stream);
      const [[subRow]] = await db.query(
        `SELECT COUNT(*) c FROM submittals
          WHERE project_id=? AND status IN ('submitted','under_review')`,
        [projectId]
      );
      const [[cnRow]] = ['pmc_head','principal','design_principal','audit'].includes(role)
        ? await db.query(
            `SELECT COUNT(*) c FROM change_notices
              WHERE project_id=? AND status='pending_approval'`,
            [projectId])
        : [[{ c: 0 }]];
      cats.push({
        key: 'drawings',
        label: 'Drawings',
        count: drCount + subRow.c + cnRow.c,
      });
    }

    // 2. Payments category — GRN pending + PR reviews + vendor engagements + claims
    const allowsPaymentsCat = ['principal','design_principal','pmc_head','senior_site_manager','site_manager','audit'].includes(role);
    if (allowsPaymentsCat) {
      // GRNs — everyone who can see this cat sees GRNs
      const [[grnRow]] = await db.query(
        `SELECT COUNT(*) c FROM grns WHERE project_id=? AND status='pending'`,
        [projectId]
      );
      let total = grnRow.c;

      // PRs — PMC/Principal only (not site managers)
      if (['principal','design_principal','pmc_head','audit'].includes(role)) {
        const prStatus = role === 'pmc_head'
          ? ['pending_pmc']
          : ['pending_pmc','pending_principal'];  // principals see both
        const [[prRow]] = await db.query(
          `SELECT COUNT(*) c FROM payment_requests
            WHERE project_id=? AND status IN (?)`,
          [projectId, prStatus]
        );
        total += prRow.c;

        // Vendor engagements pending (principal sign-off)
        if (['principal','design_principal','audit'].includes(role)) {
          const [[veRow]] = await db.query(
            `SELECT COUNT(*) c FROM vendor_engagements
              WHERE project_id=? AND approval_status='pending'`,
            [projectId]
          );
          total += veRow.c;

          // Client claims pending principal
          const [[ccRow]] = await db.query(
            `SELECT COUNT(*) c FROM client_claims
              WHERE project_id=? AND status='pending_approval'`,
            [projectId]
          );
          total += ccRow.c;
        }
      }
      cats.push({ key:'payments', label:'Payments', count: total });
    }

    // 3. Budget category — custom cost-head approvals + budget flag sign-offs
    const allowsBudgetCat = ['principal','design_principal','pmc_head','design_head','services_head','audit'].includes(role);
    if (allowsBudgetCat) {
      const [[chRow]] = await db.query(
        `SELECT COUNT(*) c FROM budget_cost_heads
          WHERE project_id=? AND status='pending'`,
        [projectId]
      );
      const [[bfRow]] = await db.query(
        `SELECT COUNT(*) c FROM budget_flags
          WHERE project_id=? AND signoff_by IS NULL`,
        [projectId]
      );
      cats.push({ key:'budget', label:'Budget', count: chRow.c + bfRow.c });
    }

    // 4. MOMs category — draft MOMs pending PMC approval
    const allowsMomsCat = ['principal','design_principal','pmc_head','audit'].includes(role);
    if (allowsMomsCat) {
      const [[mRow]] = await db.query(
        `SELECT COUNT(*) c FROM meetings WHERE project_id=? AND status='draft'`,
        [projectId]
      );
      cats.push({ key:'moms', label:'MOMs', count: mRow.c });
    }

    // 5. Other — schedule change approvals, weekly report approvals, misc.
    //    Currently returns 0 (placeholder until these workflows are extended
    //    to route through the Approvals strip).
    const allowsOtherCat = ['principal','design_principal','pmc_head','audit'].includes(role);
    if (allowsOtherCat) {
      cats.push({ key:'other', label:'Other', count: 0 });
    }

    return cats;
  }

  // ── Build buttons with counts, in the order given by BUTTONS_BY_ROLE
  const buttons = [];
  for (const key of visibleButtons) {
    let count = null;
    let label = '';
    switch (key) {
      case 'schedule':
        label = 'Schedule';
        break;
      case 'issues':
        label = ISSUES_LABEL[role] || 'Issues';
        count = await countIssues();
        break;
      case 'cns':
        label = 'CNs';
        count = await countCNs();
        break;
      case 'approvals': {
        label = 'Approvals';
        const cats = await approvalsCategories();
        count = cats.reduce((s, c) => s + c.count, 0);
        buttons.push({ key, label, count, categories: cats });
        continue;  // already pushed
      }
      case 'reports':
        label = 'Reports';
        count = await countReports();
        break;
      case 'submittals':
        label = 'Pending Submittals';
        count = await countSubmittals();
        break;
      case 'payments_queue':
        label = 'Payments Queue';
        count = await countPaymentsQueue();
        break;
      case 'todays_tasks':
        label = "Today's Tasks";
        count = await countTodaysTasks();
        break;
    }
    buttons.push({ key, label, count });
  }

  // ── Per-project PMC primary + backup (v4.3)
  // Shows in Project Summary for ALL roles. Read-only unless caller is
  // principal/design_principal (UI will show "Change" button in that case).
  const [[pmc]] = await db.query(
    `SELECT primary_pmc_id, backup_pmc_id
     FROM current_pmc_assignments
     WHERE project_id = ?`,
    [projectId]
  );
  if (pmc) {
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers([pmc.primary_pmc_id, pmc.backup_pmc_id].filter(Boolean));
    pmc.primary_name  = users.get(pmc.primary_pmc_id)?.full_name || null;
    pmc.primary_phone = users.get(pmc.primary_pmc_id)?.phone     || null;
    pmc.backup_name   = users.get(pmc.backup_pmc_id)?.full_name  || null;
    pmc.backup_phone  = users.get(pmc.backup_pmc_id)?.phone      || null;
  }

  return {
    role,
    buttons,
    pmc: pmc || { primary_pmc_id:null, backup_pmc_id:null,
                  primary_name:null, backup_name:null },
    can_change_pmc: ['principal','design_principal'].includes(role),
  };
}

// POST /api/projects — create project (principals only)
router.post('/', requireAuth, requirePrincipal, validators.project, async (req, res) => {
  try {
    const {
      code, name, client, location, project_type,
      r0_start_date, r0_end_date,
      entity_id, billing_account, jurisdiction,
      contract_value, start_date, completion_date,
      site_lat, site_lng
    } = req.body;
    let { client_id } = req.body;

    // Bug B4: stub-client INSERT and project INSERT used to be separate
    // queries with no transaction. If the project INSERT failed (e.g. dup
    // code), the stub client was orphaned AND Udupa got a notification for
    // a project that didn't exist. Now: both INSERTs run in one tx; the
    // notification fires only after commit succeeds.
    let clientStubCreated = false;

    const txResult = await db.tx(async (conn) => {
      let resolvedClientId = client_id;
      let stubCreated = false;

      if (!resolvedClientId && client) {
        const [existingRows] = await conn.query(
          'SELECT id, master_complete FROM clients WHERE LOWER(client_name) = LOWER(?) AND is_active = 1 LIMIT 1',
          [String(client).trim()]
        );
        const existing = existingRows[0];
        if (existing) {
          resolvedClientId = existing.id;
        } else {
          const [stubResult] = await conn.query(
            `INSERT INTO clients (client_name, master_complete, stub_reason, created_by)
             VALUES (?, 0, ?, ?)`,
            [String(client).trim(), `auto-created from project ${code}`, req.session.user.id]
          );
          resolvedClientId = stubResult.insertId;
          stubCreated = true;
        }
      }

      const [result] = await conn.query(
        `INSERT INTO projects
          (code, name, client, client_id, location, site_lat, site_lng,
           project_type, r0_start_date, r0_end_date,
           entity_id, billing_account, jurisdiction,
           contract_value, start_date, completion_date,
           created_by, checklist_project_created)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [code, name, client, resolvedClientId || null, location || '',
         site_lat || null, site_lng || null,
         project_type || 'commercial', r0_start_date, r0_end_date,
         entity_id || 2, billing_account || 'primary', jurisdiction || null,
         contract_value || null, start_date || r0_start_date, completion_date || r0_end_date,
         req.session.user.id]
      );

      return { projectId: result.insertId, clientId: resolvedClientId, stubCreated };
    });

    clientStubCreated = txResult.stubCreated;
    client_id = txResult.clientId;

    // Bug B5: project creation now audited.
    audit.log({ userId: req.session.user.id, action: 'project.create',
      entityType: 'projects', entityId: txResult.projectId,
      details: { code, name, client_id: client_id || null, client_stub_created: clientStubCreated, project_type, r0_start_date, r0_end_date }, req });

    // Notify Udupa about the stub — only after successful commit.
    if (clientStubCreated) {
      try {
        const Auth = require('../../auth/contract');
        const fin = await Auth.functions.getUsersByRole('finance_admin');
        if (fin[0]) {
          await notif.notify(fin[0].id, 'client_incomplete',
             `New project "${name}" created with stub client "${client}". Please complete client master (GSTIN, Tally ledger, payment terms) before raising first PI.`);
        }
      } catch(_) { /* notification is best-effort */ }
    }

    res.json({
      success: true,
      id: txResult.projectId,
      client_id: client_id || null,
      client_stub_created: clientStubCreated,
      ...(clientStubCreated ? {
        notice: `Client "${client}" added as stub — Udupa must complete client master (GSTIN, Tally ledger, payment terms) before first PI.`
      } : {})
    });

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Project code already exists' });
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// POST /api/projects/:id/assign — assign any team member to project
router.post('/:id/assign', requireAuth, requirePrincipal, async (req, res) => {
  try {
    const { user_id, role } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    await db.query(
      `INSERT INTO project_assignments (project_id, user_id, role, assigned_by)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE role=VALUES(role)`,
      [req.params.id, user_id, role||'member', req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'project.assign',
      entityType: 'project_assignments', entityId: null,
      details: { project_id: parseInt(req.params.id), assigned_user_id: user_id, assignment_role: role || 'member' }, req });
    res.json({ success: true });
  } catch (_err) { res.status(500).json({ error: 'Assign failed' }); }
});

// POST /api/projects/:id/assign-site-manager (PMC Head)
router.post('/:id/assign-site-manager', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { user_id } = req.body;
    const project_id  = req.params.id;

    // Check user is a site manager — both regular and senior qualify
    // M1 Auth owns users — go through its contract
    const Auth = require('../../auth/contract');
    const user = await Auth.functions.getUser(user_id);
    if (!user || !['site_manager', 'senior_site_manager'].includes(user.role)) {
      return res.status(400).json({ error: 'User is not a site manager' });
    }

    // Create new assignment (site managers can have multiple)
    await db.query(
      'INSERT INTO project_assignments (project_id, user_id, assigned_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE is_active=1',
      [project_id, user_id, req.session.user.id]
    );

    // Update checklist
    await db.query('UPDATE projects SET checklist_site_manager = 1 WHERE id = ?', [project_id]);

    // M3 Readiness Gate — single source of truth for "can project go active"
    const ReadinessGate = require('../../readiness-gate/contract');
    await ReadinessGate.functions.activateIfReady(project_id);

    audit.log({ userId: req.session.user.id, action: 'project.assign_site_manager',
      entityType: 'project_assignments', entityId: null,
      details: { project_id: parseInt(project_id), user_id: parseInt(user_id), site_manager_role: user.role }, req });

    res.json({ success: true });

  }));

// POST /api/projects/:id/leave — PMC marks site manager on leave
router.post('/:id/leave', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { user_id, leave_from, leave_to, reason } = req.body;
    if (!user_id || !leave_from || !leave_to) return res.status(400).json({ error: 'User and dates required' });
    // M4 Site owns site_manager_leave — go through its contract, never direct INSERT
    const Site = require('../../site/contract');
    await Site.functions.recordSiteManagerLeave({
      userId:    user_id,
      projectId: req.params.id,
      leaveFrom: leave_from,
      leaveTo:   leave_to,
      reason,
      markedBy:  req.session.user.id,
    });
    audit.log({ userId: req.session.user.id, action: 'project.site_manager_leave_recorded',
      entityType: 'site_manager_leave', entityId: null,
      details: { project_id: parseInt(req.params.id), user_id: parseInt(user_id), leave_from, leave_to, reason: reason || null }, req });
    res.json({ success: true, message: 'Leave recorded — alerts suppressed for this period' });
  }));

// GET /api/projects/:id/leave — get leave records
router.get('/:id/leave', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const Site = require('../../site/contract');
    const Auth = require('../../auth/contract');
    const leaves = await Site.functions.listManagerLeaveRecords(req.params.id);
    const users = await Auth.functions.getUsers(
      leaves.flatMap(l => [l.user_id, l.marked_by].filter(Boolean))
    );
    leaves.forEach(l => {
      l.site_manager_name = users.get(l.user_id)?.full_name   || null;
      l.marked_by_name    = users.get(l.marked_by)?.full_name || null;
    });
    res.json({ leaves });
  }));

// POST /api/projects/:id/notify-client — email client a status update
// Frontend (Accordion → ⚡ Email client button) calls this after a confirmation
// modal. The body just carries a context tag; subject/body are templated server-side.
router.post('/:id/notify-client', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { context } = req.body;
    const projectId = parseInt(req.params.id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });

    const [[proj]] = await db.query(
      `SELECT p.id, p.name AS project_name, p.client_id, c.contact_email, c.contact_person, c.client_name
       FROM projects p LEFT JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [projectId]
    );
    if (!proj) return res.status(404).json({ error: 'Project not found' });
    if (!proj.contact_email) {
      return res.status(400).json({ error: 'Client has no email on file. Update client master first.' });
    }

    const subject = `Update from nu associates PMC — ${proj.project_name}`;
    const body = `Dear ${proj.contact_person || 'Sir/Madam'},

This is a status update for project ${proj.project_name} (context: ${context || 'general'}).

Please log in to the nu PMC portal for full details.

Regards,
nu associates`;

    try {
      const email = require('../../../services/email');
      await email.send(proj.contact_email, subject, body);
      audit.log({ userId: req.session.user.id, action: 'project.notify_client',
        entityType: 'projects', entityId: projectId,
        details: { client_id: proj.client_id, recipient_email: proj.contact_email, context: context || 'general' }, req });
      res.json({ ok: true, success: true, message: 'Client notified' });
    } catch (err) {
      console.error('[projects notify-client]', err);
      res.status(500).json({ error: 'Failed to send email — try again later' });
    }
  }));

module.exports = router;
