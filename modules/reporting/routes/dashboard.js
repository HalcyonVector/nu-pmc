// routes/dashboard.js
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const { PRINCIPALS } = require('../../../services/roles');
const router  = express.Router();

// Which dashboard categories each role sees. Roles not listed here
// fall through to an empty list (their dashboard shows projects summary
// only). This is a minimum-fix map for B7 — eventual home is Sheet 5
// (Tab Visibility Map) once that import path is wired up.
const ROLE_CATEGORIES = {
  principal:           ['overdue_queries','fresh_queries','open_flags','pending_approvals','overdue_materials','pending_changes'],
  design_principal:    ['overdue_queries','fresh_queries','open_flags','pending_approvals','overdue_materials','pending_changes'],
  pmc_head:            ['overdue_queries','fresh_queries','open_flags','pending_approvals','overdue_materials','pending_changes'],
  design_head:         ['overdue_queries','fresh_queries','pending_changes'],
  services_head:       ['overdue_queries','fresh_queries','pending_changes'],
  site_manager:        ['overdue_queries','fresh_queries','open_flags','overdue_materials'],
  senior_site_manager: ['overdue_queries','fresh_queries','open_flags','overdue_materials'],
  coordinator:         ['overdue_queries','fresh_queries'],
  team_lead:           ['overdue_queries','fresh_queries'],
  jr_architect:        ['overdue_queries','fresh_queries'],
  services_engineer:   ['overdue_queries','fresh_queries'],
  finance_admin:       [],
};

// GET /api/dashboard — role-aware action centre.
// Principals see firm-wide. Everyone else sees their assigned projects only.
// Each role sees only the categories they can actually act on.
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
    const isProjectScoped = PROJECT_SCOPED_ROLES.includes(me.role);
    const isFirmWide = !isProjectScoped;
    const wants = ROLE_CATEGORIES[me.role] || [];

    // Resolve project scope. Firm-wide roles → all active. Project-scoped roles → their assignments.
    let scopedProjectIds = null;
    if (isProjectScoped) {
      const [rows] = await db.query(
        `SELECT pa.project_id
         FROM project_assignments pa
         JOIN projects p ON p.id = pa.project_id AND p.status = 'active'
         WHERE pa.user_id = ? AND pa.is_active = 1`,
        [me.id]
      );
      scopedProjectIds = rows.map(r => r.project_id);

      // No assignments → return empty action centre + empty project list.
      if (scopedProjectIds.length === 0) {
        return res.json({
          action_centre: {
            overdue_queries:[], fresh_queries:[], open_flags:[],
            pending_approvals:[], overdue_materials:[], pending_changes:[],
          },
          projects: [],
          summary: {
            total_overdue_queries:0, total_fresh_queries:0, total_open_flags:0,
            total_pending_approvals:0, total_overdue_materials:0, total_pending_changes:0,
          }
        });
      }
    }

    // Build the project filter clause + params for project-scoped roles.
    const projFilter = isFirmWide ? '' : ' AND project_id IN (?)';
    const projParams = isFirmWide ? []  : [scopedProjectIds];

    // Helper that returns [] when the role doesn't get this category,
    // saving the DB hit and keeping the response shape consistent.
    const fetchIfWanted = async (key, sql, params) => {
      if (!wants.includes(key)) return [];
      const [rows] = await db.query(sql, params);
      return rows;
    };

    // Overdue drawing queries (>=3 days open)
    const overdueQueries = await fetchIfWanted('overdue_queries',
      `SELECT id, description, raised_at, project_id, drawing_version_id,
         DATEDIFF(NOW(), raised_at) AS days_open
       FROM issues
       WHERE status != 'closed' AND DATEDIFF(NOW(), raised_at) >= 3
             AND drawing_version_id IS NOT NULL${projFilter}
       ORDER BY days_open DESC`,
      projParams
    );

    // Fresh queries (<3 days)
    const freshQueries = await fetchIfWanted('fresh_queries',
      `SELECT id, description, raised_at, project_id, drawing_version_id,
         DATEDIFF(NOW(), raised_at) AS days_open
       FROM issues
       WHERE status != 'closed' AND DATEDIFF(NOW(), raised_at) < 3
             AND drawing_version_id IS NOT NULL${projFilter}
       ORDER BY raised_at DESC`,
      projParams
    );

    // Hydrate drawing context (number + revision) for both query sets
    const DS = require('../../design-services/contract');
    const allDvIds = [...overdueQueries, ...freshQueries].map(r => r.drawing_version_id).filter(Boolean);
    const dvCtx = await DS.functions.getDrawingContextByVersionIds(allDvIds);
    const hydrateDv = (r) => {
      const c = dvCtx.get(r.drawing_version_id);
      r.drawing_number = c?.drawing_number || null;
      r.revision       = c?.revision || null;
    };
    overdueQueries.forEach(hydrateDv);
    freshQueries.forEach(hydrateDv);

    // Open task flags
    // schedule_tasks doesn't have project_id directly — go via task_updates.project_id
    const openFlags = await fetchIfWanted('open_flags',
      `SELECT tu.id, tu.flag_note, tu.project_id, st.task_name, st.trade
       FROM task_updates tu
       JOIN schedule_tasks st ON tu.task_id = st.id
       WHERE tu.is_flagged = 1 AND tu.flag_resolved = 0${projFilter ? ' AND tu.project_id IN (?)' : ''}
       ORDER BY tu.created_at DESC`,
      projParams
    );

    // Pending approvals — reads from the unified approvals table.
    // wa_pending_actions (legacy) is retired for the app-channel surface.
    const pendingApprovals = await fetchIfWanted('pending_approvals',
      `SELECT a.id, a.approval_type AS request_type, a.title, NULL AS drift_days,
         a.raised_at, a.raised_by, a.project_id
       FROM approvals a
       WHERE a.status = 'pending'${projFilter ? ' AND a.project_id IN (?)' : ''}
       ORDER BY a.raised_at ASC`,
      projParams
    );
    if (pendingApprovals.length) {
      const Auth = require('../../auth/contract');
      const users = await Auth.functions.getUsers(pendingApprovals.map(a => a.raised_by).filter(Boolean));
      pendingApprovals.forEach(a => { a.raised_by_name = users.get(a.raised_by)?.full_name || null; });
    }

    // Overdue materials
    const overdueMaterials = await fetchIfWanted('overdue_materials',
      `SELECT mr.id, mr.needed_by_date, mr.quantity_needed, mr.project_id,
         bi.item_name, bi.trade, bi.unit
       FROM material_requests mr
       JOIN boq_items bi ON mr.boq_item_id = bi.id
       WHERE mr.is_overdue = 1${projFilter ? ' AND mr.project_id IN (?)' : ''}
       ORDER BY mr.needed_by_date ASC`,
      projParams
    );

    // Change notices pending signatures (commercial — only for sign-off roles)
    const pendingChanges = await fetchIfWanted('pending_changes',
      `SELECT cn.id, cn.cn_number, cn.title, cn.project_id,
         cn.sig_design_head, cn.sig_services_head, cn.sig_pmc
       FROM change_notices cn
       WHERE cn.status = 'collecting_sigs'${projFilter ? ' AND cn.project_id IN (?)' : ''}
       ORDER BY cn.raised_at ASC`,
      projParams
    );

    // Bulk-hydrate project names across all 6 result sets
    const Onboarding = require('../../onboarding/contract');
    const allProjIds = [
      ...overdueQueries.map(r => r.project_id),
      ...freshQueries.map(r => r.project_id),
      ...openFlags.map(r => r.project_id),
      ...pendingApprovals.map(r => r.project_id),
      ...overdueMaterials.map(r => r.project_id),
      ...pendingChanges.map(r => r.project_id),
    ].filter(Boolean);
    const dashProjs = await Onboarding.functions.getProjectsByIds(allProjIds);
    const addName = (arr) => arr.forEach(r => { r.project_name = dashProjs.get(r.project_id)?.name || null; });
    addName(overdueQueries); addName(freshQueries); addName(openFlags);
    addName(pendingApprovals); addName(overdueMaterials); addName(pendingChanges);

    // Projects summary — also project-scoped for non-principals.
    const projectsFilter = isFirmWide
      ? "WHERE p.status IN ('active')"
      : "WHERE p.status IN ('active') AND p.id IN (?)";
    const [projects] = await db.query(
      `SELECT p.id, p.code, p.name, p.status, p.r0_end_date, p.client, p.location,
         p.checklist_project_created, p.checklist_design_boq, p.checklist_services_boq, p.checklist_schedule, p.checklist_site_manager,
         COUNT(DISTINCT dq.id) AS open_queries,
         COUNT(DISTINCT tu.id) AS open_flags,
         COUNT(DISTINCT cn.id) AS open_changes,
         ANY_VALUE(sv.drift_days) AS drift_days,
         ANY_VALUE(sv.label)      AS schedule_version
       FROM projects p
       LEFT JOIN issues dq ON dq.project_id = p.id AND dq.status != 'closed' AND dq.drawing_version_id IS NOT NULL
       LEFT JOIN task_updates tu    ON tu.project_id = p.id AND tu.is_flagged = 1
       LEFT JOIN change_notices cn  ON cn.project_id = p.id AND cn.status NOT IN ('approved','rejected')
       LEFT JOIN schedule_versions sv ON sv.project_id = p.id AND sv.is_current = 1
       ${projectsFilter}
       GROUP BY p.id`,
      isFirmWide ? [] : [scopedProjectIds]
    );

    // Batch per-project enrichment — replaces N*2 queries with 2 total.
    if (projects.length) {
      const dashProjectIds = projects.map(p => p.id);

      // Overdue material requests
      const [overMBatch] = await db.query(
        `SELECT project_id, COUNT(*) AS c
           FROM material_requests WHERE project_id IN (?) AND is_overdue = 1
           GROUP BY project_id`,
        [dashProjectIds]
      );
      const overMMap = new Map(overMBatch.map(r => [r.project_id, Number(r.c)]));

      // Schedule summary — batch equivalent of DS.functions.getCurrentScheduleSummary().
      // Uses the same logic as the contract function but across all projects in one query.
      const [scheduleSummaryBatch] = await db.query(
        `SELECT sv.project_id,
           COUNT(*) AS total_tasks,
           SUM(CASE WHEN latest_pct.pct = 100           THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN latest_pct.pct BETWEEN 1 AND 99 THEN 1 ELSE 0 END) AS in_progress,
           COALESCE(AVG(latest_pct.pct), 0) AS avg_pct_complete,
           MAX(latest_pct.report_date) AS last_update_date
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
         LEFT JOIN (
           SELECT tu1.task_id, tu1.pct_complete AS pct, tu1.report_date
             FROM task_updates tu1
            WHERE tu1.id = (SELECT MAX(tu2.id) FROM task_updates tu2 WHERE tu2.task_id = tu1.task_id)
         ) latest_pct ON latest_pct.task_id = st.id
         WHERE sv.project_id IN (?)
         GROUP BY sv.project_id`,
        [dashProjectIds]
      );
      const schedSumMap = new Map(scheduleSummaryBatch.map(r => [r.project_id, r]));

      for (const p of projects) {
        const schedSum = schedSumMap.get(p.id);
        const avg_pct  = Math.round(parseFloat(schedSum?.avg_pct_complete) || 0);
        p.avg_pct = avg_pct;
        p.stats = {
          open_queries:      p.open_queries || 0,
          flagged_tasks:     p.open_flags   || 0,
          overdue_materials: overMMap.get(p.id) || 0,
        };
      }
    }

    res.json({
      action_centre: {
        overdue_queries:   overdueQueries,
        fresh_queries:     freshQueries,
        open_flags:        openFlags,
        pending_approvals: pendingApprovals,
        overdue_materials: overdueMaterials,
        pending_changes:   pendingChanges,
      },
      projects,
      summary: {
        total_overdue_queries:   overdueQueries.length,
        total_fresh_queries:     freshQueries.length,
        total_open_flags:        openFlags.length,
        total_pending_approvals: pendingApprovals.length,
        total_overdue_materials: overdueMaterials.length,
        total_pending_changes:   pendingChanges.length,
      }
    });

  }));

// GET /api/dashboard/morning-brief — role-curated overnight activity summary
// Shows ONLY what changed since yesterday. Standing totals live in the Action Centre.
router.get('/morning-brief', requireAuth, asyncHandler(async (req, res) => {
  const me    = req.session.user;
  const role  = me.role;
  const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');

  // "Since yesterday morning" — 24 hours ago
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Resolve project scope for project-scoped roles
  let scopedIds = null;
  if (PROJECT_SCOPED_ROLES.includes(role)) {
    const [rows] = await db.query(
      `SELECT pa.project_id FROM project_assignments pa
       JOIN projects p ON p.id = pa.project_id AND p.status = 'active'
       WHERE pa.user_id = ? AND pa.is_active = 1`, [me.id]
    );
    scopedIds = rows.map(r => r.project_id);
    if (!scopedIds.length) {
      return res.json({ role, metrics: [], items: [], total_activity: 0, needs_attention: false,
        summary: 'No active projects assigned yet.' });
    }
  }

  // Helper: count rows
  const count = async (sql, params = []) => {
    const [[row]] = await db.query(sql, params);
    return Number(row.cnt || 0);
  };
  // Project scope helpers
  const pf = scopedIds ? ' AND project_id IN (?)' : '';
  const pp = scopedIds ? [scopedIds] : [];

  let metrics = [];
  let items   = [];
  let needsAttention = false;

  // Metric builder helpers — "since yesterday" vs "today" vs "needs action"
  const addSince = (n, singular, plural, lbl) => {
    if (!n) return;
    metrics.push({ val: n, lbl });
    items.push(`${n} ${n > 1 ? plural : singular} since yesterday`);
  };
  const addToday = (n, singular, plural, lbl) => {
    if (!n) return;
    metrics.push({ val: n, lbl });
    items.push(`${n} ${n > 1 ? plural : singular} today`);
  };
  const addAction = (n, text, lbl, urgent = false) => {
    if (!n) return;
    metrics.push({ val: n, lbl });
    items.push(text);
    if (urgent) needsAttention = true;
  };

  // ── Principal / Design Principal ─────────────────────────────────────
  if (['principal', 'design_principal'].includes(role)) {
    const [drawings, payments, newFlags, newIssues, reports, pendingAppr] = await Promise.all([
      count('SELECT COUNT(*) AS cnt FROM drawing_versions WHERE created_at >= ?', [since]),
      count('SELECT COUNT(*) AS cnt FROM vendor_payments WHERE raised_at >= ?', [since]),
      count('SELECT COUNT(*) AS cnt FROM task_updates WHERE is_flagged = 1 AND created_at >= ?', [since]),
      count('SELECT COUNT(*) AS cnt FROM issues WHERE raised_at >= ? AND status != ?', [since, 'closed']),
      count('SELECT COUNT(*) AS cnt FROM weekly_reports WHERE created_at >= ?', [since]),
      count('SELECT COUNT(*) AS cnt FROM approvals WHERE status = ?', ['pending']),
    ]);
    addSince(drawings,  'drawing issued',       'drawings issued',        'Drawings');
    addSince(payments,  'payment raised',        'payments raised',         'Payments');
    addSince(newFlags,  'flag raised',           'flags raised',            'New Flags');
    addSince(newIssues, 'issue logged',          'issues logged',           'New Issues');
    addSince(reports,   'report submitted',      'reports submitted',       'Reports');
    addAction(pendingAppr, `${pendingAppr} approval${pendingAppr>1?'s':''} awaiting your sign-off`, 'Pending', true);
    const total = drawings + payments + newFlags + newIssues + reports;
    return res.json({ role, metrics, items, total_activity: total, needs_attention: needsAttention,
      summary: items.length ? items.join(' · ') : 'No overnight activity across projects.' });
  }

  // ── PMC Head ──────────────────────────────────────────────────────────
  if (role === 'pmc_head') {
    const [pendingAppr, newFlags, todayReports, newIssues, pendingChanges] = await Promise.all([
      count('SELECT COUNT(*) AS cnt FROM approvals WHERE status = ?', ['pending']),
      count('SELECT COUNT(*) AS cnt FROM task_updates WHERE is_flagged = 1 AND created_at >= ?', [since]),
      count('SELECT COUNT(*) AS cnt FROM weekly_reports WHERE DATE(created_at) = ?', [today]),
      count('SELECT COUNT(*) AS cnt FROM issues WHERE raised_at >= ? AND status != ?', [since, 'closed']),
      count('SELECT COUNT(*) AS cnt FROM change_notices WHERE status = ?', ['collecting_sigs']),
    ]);
    addAction(pendingAppr,    `${pendingAppr} approval${pendingAppr>1?'s':''} awaiting sign-off`,     'Approvals', true);
    addAction(pendingChanges, `${pendingChanges} change notice${pendingChanges>1?'s':''} need sign-off`, 'Changes',   true);
    addSince(newFlags,  'flag raised',      'flags raised',     'New Flags');
    addSince(newIssues, 'issue logged',     'issues logged',    'New Issues');
    addToday(todayReports, 'report in',    'reports in',       'Reports');
    const total = newFlags + todayReports + newIssues;
    return res.json({ role, metrics, items, total_activity: total, needs_attention: needsAttention,
      summary: items.length ? items.join(' · ') : 'All clear — nothing new overnight.' });
  }

  // ── Site Manager / Senior Site Manager ────────────────────────────────
  if (['site_manager', 'senior_site_manager'].includes(role)) {
    const [newIssues, dueTasks, newFlags, todayLabour, newUpdates] = await Promise.all([
      count(`SELECT COUNT(*) AS cnt FROM issues WHERE raised_at >= ? AND status != ?${pf}`, [since, 'closed', ...pp]),
      count(`SELECT COUNT(*) AS cnt FROM schedule_tasks st
             JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
             WHERE st.end_date = ?${scopedIds ? ' AND sv.project_id IN (?)' : ''}`,
        scopedIds ? [today, scopedIds] : [today]),
      count(`SELECT COUNT(*) AS cnt FROM task_updates WHERE is_flagged = 1 AND created_at >= ?${pf}`, [since, ...pp]),
      count(`SELECT COUNT(*) AS cnt FROM labour_register WHERE DATE(work_date) = ?${pf}`, [today, ...pp]),
      count(`SELECT COUNT(*) AS cnt FROM task_updates WHERE created_at >= ?${pf}`, [since, ...pp]),
    ]);
    addAction(dueTasks,  `${dueTasks} task${dueTasks>1?'s':''} due today — check schedule`,         'Due Today', true);
    addSince(newFlags,   'flag raised on site',  'flags raised on site', 'New Flags');
    addSince(newIssues,  'issue raised',          'issues raised',        'New Issues');
    addToday(newUpdates, 'task update logged',   'task updates logged',  'Updates');
    addToday(todayLabour,'labour entry',         'labour entries',       'Labour');
    const total = newIssues + newFlags + newUpdates;
    return res.json({ role, metrics, items, total_activity: total, needs_attention: needsAttention,
      summary: items.length ? items.join(' · ') : 'No overnight activity on your sites.' });
  }

  // ── Finance Admin ─────────────────────────────────────────────────────
  if (role === 'finance_admin') {
    const [pendingVendors, newPayments, newPayReqs] = await Promise.all([
      count(`SELECT COUNT(*) AS cnt FROM vendors WHERE clearance_status = ?`, ['pending']),
      count(`SELECT COUNT(*) AS cnt FROM vendor_payments WHERE raised_at >= ?`, [since]),
      count(`SELECT COUNT(*) AS cnt FROM payment_requests WHERE created_at >= ?`, [since]),
    ]);
    addAction(pendingVendors, `${pendingVendors} vendor${pendingVendors>1?'s':''} awaiting finance clearance`, 'Pending', true);
    addSince(newPayments, 'payment request raised', 'payment requests raised', 'Payments');
    addSince(newPayReqs,  'payment request created', 'payment requests created', 'New Reqs');
    const total = newPayments + newPayReqs;
    return res.json({ role, metrics, items, total_activity: total, needs_attention: needsAttention,
      summary: items.length ? items.join(' · ') : 'No new finance activity overnight.' });
  }

  // ── Design Head / Team Lead / Jr Architect / Jr Engineer ──────────────
  if (['design_head', 'team_lead', 'jr_architect', 'jr_engineer'].includes(role)) {
    const [overdueQueries, newQueries, newDrawings] = await Promise.all([
      count(`SELECT COUNT(*) AS cnt FROM issues WHERE status != ? AND drawing_version_id IS NOT NULL AND DATEDIFF(NOW(), raised_at) >= 3${pf}`, ['closed', ...pp]),
      count(`SELECT COUNT(*) AS cnt FROM issues WHERE raised_at >= ? AND status != ? AND drawing_version_id IS NOT NULL${pf}`, [since, 'closed', ...pp]),
      count(`SELECT COUNT(*) AS cnt FROM drawing_versions WHERE created_at >= ?`, [since]),
    ]);
    addAction(overdueQueries, `${overdueQueries} drawing quer${overdueQueries>1?'ies':'y'} unanswered 3+ days — needs response`, 'Overdue', true);
    addSince(newQueries,  'new query raised on drawings', 'new queries raised on drawings', 'New Queries');
    addSince(newDrawings, 'drawing issued',               'drawings issued',                'Drawings');
    const total = newQueries + newDrawings;
    return res.json({ role, metrics, items, total_activity: total, needs_attention: needsAttention,
      summary: items.length ? items.join(' · ') : 'No drawing activity overnight.' });
  }

  // ── Services Head / Services Engineer ─────────────────────────────────
  if (['services_head', 'services_engineer'].includes(role)) {
    const [pendingSubmittals, newIssues, newSubmittals] = await Promise.all([
      count(`SELECT COUNT(*) AS cnt FROM submittals WHERE status NOT IN ('approved','rejected')${pf}`, pp),
      count(`SELECT COUNT(*) AS cnt FROM issues WHERE raised_at >= ? AND status != ?${pf}`, [since, 'closed', ...pp]),
      count(`SELECT COUNT(*) AS cnt FROM submittals WHERE submitted_at >= ?${pf}`, [since, ...pp]),
    ]);
    addAction(pendingSubmittals, `${pendingSubmittals} submittal${pendingSubmittals>1?'s':''} awaiting review`, 'Pending', true);
    addSince(newSubmittals, 'submittal submitted',  'submittals submitted', 'New');
    addSince(newIssues,     'issue raised',         'issues raised',        'New Issues');
    const total = newSubmittals + newIssues;
    return res.json({ role, metrics, items, total_activity: total, needs_attention: needsAttention,
      summary: items.length ? items.join(' · ') : 'No services activity overnight.' });
  }

  // ── Coordinator / Trainee / Others ────────────────────────────────────
  const [taskUpdates, newQueries] = await Promise.all([
    count(`SELECT COUNT(*) AS cnt FROM task_updates WHERE created_at >= ?${pf}`, [since, ...pp]),
    count(`SELECT COUNT(*) AS cnt FROM issues WHERE raised_at >= ? AND status != ?${pf}`, [since, 'closed', ...pp]),
  ]);
  addSince(taskUpdates, 'task update logged', 'task updates logged',    'Updates');
  addSince(newQueries,  'new query raised',   'new queries raised',     'New Queries');
  return res.json({ role, metrics, items, total_activity: taskUpdates + newQueries, needs_attention: false,
    summary: items.length ? items.join(' · ') : 'All quiet overnight.' });
}));


module.exports = router;
