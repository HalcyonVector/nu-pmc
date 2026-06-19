// routes/needs-you.js — Role-aware pending-action counts.
//
// Powers the ⚡ Needs You pinned section at the top of the Work bucket
// (Sprint 2 Item 5). Each role sees a different breakdown of items that
// are "waiting for them to action".
//
// Endpoint:
//   GET /api/needs-you/me — { total, items: [{type, count, label, tab}] }
//
// Project-scoped roles (per PROJECT_SCOPED_ROLES in middleware/auth.js)
// count only items from their assigned projects. Firm-wide roles (PMC
// Head, Design Head, etc.) count across all active projects.
//
// Guidelines for "count or skip":
//   - Only include an item row when count > 0 (empty rows don't help the user)
//   - Frontend hides the entire pinned section when items.length === 0

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// Run a COUNT(*) query and return an integer. Accepts optional project-id
// filter; when the role is project-scoped and has assigned projects, pass
// the ids array to add `AND project_id IN (?)` to the WHERE clause.
// countWithScope — run a COUNT(*) query and return an integer, appending
// a project-scope filter if the caller is project-scoped.
//
// Signature changed Sprint 4 Item 4: the `scopeColumn` arg is now
// explicit. The previous version auto-detected by string-scanning
// the SQL template for 'dv.' or 'd.' — fragile once more joins
// get added (e.g. a template with both 'dr.' AND 'd.' could pick
// the wrong scope column silently).
//
// Usage:
//   countWithScope(
//     "SELECT COUNT(*) cnt FROM daily_reports WHERE status='pending_review'{SCOPE}",
//     [], projectIds,
//     'project_id'
//   )
//   countWithScope(
//     "SELECT COUNT(*) cnt FROM drawing_versions dv JOIN drawings d ON dv.drawing_id=d.id WHERE dv.status='pending_l2'{SCOPE}",
//     [], projectIds,
//     'd.project_id'
//   )
async function countWithScope(sqlTemplate, baseParams, projectIds, scopeColumn = 'project_id') {
  // If role is project-scoped but has no projects, the count is trivially 0.
  if (projectIds && projectIds.length === 0) return 0;
  let sql = sqlTemplate;
  const params = [...baseParams];
  if (projectIds && projectIds.length) {
    const scopeClause = ` AND ${scopeColumn} IN (?)`;
    sql = sqlTemplate.replace('{SCOPE}', scopeClause);
    params.push(projectIds);
  } else {
    sql = sqlTemplate.replace('{SCOPE}', '');
  }
  const [[r]] = await db.query(sql, params);
  return parseInt(r.cnt || 0);
}

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const role = me.role;
  const items = [];

  // Query project assignments fresh from DB (not session cache) to avoid stale counts.
  let projectIds;
  if (PROJECT_SCOPED_ROLES.includes(role)) {
    const [rows] = await db.query(
      `SELECT pa.project_id FROM project_assignments pa
       JOIN projects p ON pa.project_id = p.id
       WHERE pa.user_id = ? AND pa.is_active = 1 AND p.status != 'completed'`,
      [me.id]
    );
    projectIds = rows.map(r => r.project_id);
  } else {
    projectIds = null; // firm-wide — no filter
  }

  // Helper for concise per-item logic
  const push = (type, count, label, tab) => {
    if (count > 0) items.push({ type, count, label, tab });
  };

  // ─── PMC Head ──────────────────────────────────────────────────────
  if (role === 'pmc_head') {
    const [reports, moms, prs, grns] = await Promise.all([
      countWithScope(
        "SELECT COUNT(*) cnt FROM daily_reports WHERE status='pending_review'{SCOPE}",
        [], projectIds
      ),
      countWithScope(
        "SELECT COUNT(*) cnt FROM meetings WHERE status='draft'{SCOPE}",
        [], projectIds
      ),
      countWithScope(
        "SELECT COUNT(*) cnt FROM payment_requests WHERE status='pending_pmc'{SCOPE}",
        [], projectIds
      ),
      countWithScope(
        "SELECT COUNT(*) cnt FROM grns WHERE status='pending'{SCOPE}",
        [], projectIds
      ),
    ]);
    push('reports',  reports, 'Reports to approve',     'reports_daily');
    push('meetings', moms,    'MOMs awaiting approval', 'meetings');
    push('payments', prs,     'PRs to review',          'payments');
    push('grn',      grns,    'GRNs to sign off',       'grn');

    // ── Radar items — operational flags requiring investigation ──────
    // These have no count badge; they link directly to the relevant tab.
    // Only fired when genuinely actionable (same thresholds as 7AM digest).

    // Radar 1: upcoming task blocked by a lagging predecessor
    const radarProjects = projectIds
      ? await db.query('SELECT id FROM projects WHERE id IN (?) AND status=?', [projectIds, 'active']).then(([r]) => r)
      : await db.query('SELECT id FROM projects WHERE status=?', ['active']).then(([r]) => r);

    for (const proj of radarProjects) {
      const [blockingTasks] = await db.query(
        `SELECT st.task_name, dep.id AS dep_id, dep.task_name AS dep_name
         FROM schedule_tasks st
         JOIN schedule_versions sv
           ON st.schedule_version_id = sv.id
          AND sv.is_current = 1 AND sv.project_id = ?
         JOIN schedule_tasks dep ON st.depends_on_task_id = dep.id
         LEFT JOIN (
           SELECT tu2.task_id, tu2.pct_complete
           FROM task_updates tu2
           INNER JOIN (
             SELECT task_id, MAX(report_date) AS latest
             FROM task_updates GROUP BY task_id
           ) mx ON tu2.task_id = mx.task_id AND tu2.report_date = mx.latest
         ) tu ON tu.task_id = dep.id
         WHERE st.start_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
           AND dep.end_date >= CURDATE()
           AND COALESCE(tu.pct_complete, 0) < (
             ROUND(LEAST(100,
               DATEDIFF(CURDATE(), dep.start_date) /
               GREATEST(1, DATEDIFF(dep.end_date, dep.start_date)) * 100
             ), 1) - 15
           )
         LIMIT 1`,
        [proj.id]);

      if (blockingTasks.length) {
        const bt = blockingTasks[0];
        items.push({
          type:    'radar_blocking',
          kind:    'radar',
          label:   bt.dep_name + ' blocking ' + bt.task_name,
          tab:     'schedule',
          project: proj.id,
          item:    bt.dep_id,
        });
      }

      // Radar 2: contractor headcount low ≥3 days
      const [thinLabour] = await db.query(
        `SELECT v.vendor_name, lr.trade
         FROM labour_register lr
         JOIN vendor_engagements ve
           ON lr.engagement_id = ve.id
          AND ve.is_active = 1
          AND ve.approval_status = 'approved'
         JOIN vendors v ON ve.vendor_id = v.id
         WHERE lr.project_id = ?
           AND lr.register_date >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
         GROUP BY ve.id, v.vendor_name, lr.trade
         HAVING (
           SELECT ROUND(AVG(l2.headcount), 1)
           FROM labour_register l2
           WHERE l2.engagement_id = ve.id AND l2.project_id = ?
             AND l2.register_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                                      AND DATE_SUB(CURDATE(), INTERVAL 4 DAY)
         ) > 0
         AND AVG(lr.headcount) < (
           SELECT ROUND(AVG(l2.headcount), 1)
           FROM labour_register l2
           WHERE l2.engagement_id = ve.id AND l2.project_id = ?
             AND l2.register_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 14 DAY)
                                      AND DATE_SUB(CURDATE(), INTERVAL 4 DAY)
         ) * 0.6
         AND COUNT(DISTINCT lr.register_date) >= 3
         LIMIT 1`,
        [proj.id, proj.id, proj.id]);

      if (thinLabour.length) {
        const tl = thinLabour[0];
        items.push({
          type:    'radar_labour',
          kind:    'radar',
          label:   tl.vendor_name + ' (' + tl.trade + ') headcount low',
          tab:     'labour',
          project: proj.id,
          item:    null,
        });
      }

      // Radar 3: drift event unresolved >2 days
      // Gracefully skipped if drift_events table not yet migrated
      try {
        const [[unresolvedDrift]] = await db.query(
          `SELECT id, cause_type, cause_label
           FROM drift_events
           WHERE project_id = ?
             AND mitigation_note IS NULL
             AND DATEDIFF(CURDATE(), DATE(created_at)) > 2
           ORDER BY created_at ASC LIMIT 1`,
          [proj.id]);
        if (unresolvedDrift) {
          items.push({
            type:    'radar_drift',
            kind:    'radar',
            label:   'Drift unresolved — ' + unresolvedDrift.cause_label,
            tab:     'schedule',
            project: proj.id,
            item:    unresolvedDrift.id,
          });
        }
      } catch (e) {
        if (!e.message.includes("doesn't exist"))
          console.warn('[needs-you radar_drift]', e.message);
      }
    }
  }

  // ─── Design Head / Detailing Head (mirrored baselines) ──────────────
  else if (role === 'design_head') {
    const DS = require('../../design-services/contract');
    const [draws, subs, mats] = await Promise.all([
      DS.functions.countDrawingVersionsMulti(projectIds, ['pending_l2'], 'design'),
      countWithScope(
        "SELECT COUNT(*) cnt FROM submittals WHERE status IN ('submitted','under_review'){SCOPE}",
        [], projectIds
      ),
      countWithScope(
        "SELECT COUNT(*) cnt FROM material_approvals WHERE approval_status='pending'{SCOPE}",
        [], projectIds
      ),
    ]);
    push('drawings',   draws, 'Drawings pending review', 'drawings');
    push('submittals', subs,  'Submittals to review',    'submittals');
    push('materials',  mats,  'Material approvals',      'materials');
  }

  // ─── Services Head ─────────────────────────────────────────────────
  else if (role === 'services_head') {
    const DS = require('../../design-services/contract');
    const [draws, subs, mats] = await Promise.all([
      DS.functions.countDrawingVersionsMulti(projectIds, ['pending_l1'], 'services'),
      countWithScope(
        "SELECT COUNT(*) cnt FROM submittals WHERE status IN ('submitted','under_review'){SCOPE}",
        [], projectIds
      ),
      countWithScope(
        "SELECT COUNT(*) cnt FROM material_approvals WHERE approval_status='pending'{SCOPE}",
        [], projectIds
      ),
    ]);
    push('drawings',   draws, 'Drawings pending review', 'drawings');
    push('submittals', subs,  'Submittals to review',    'submittals');
    push('materials',  mats,  'Material approvals',      'materials');
  }

  // ─── Team Lead ─────────────────────────────────────────────────────
  // Team's pending items: drawings at L1 in their stream, team RFIs, team
  // submittals that were returned for resubmission.
  else if (role === 'team_lead') {
    const stream = me.stream || 'design';
    const DS = require('../../design-services/contract');
    const [draws, rfis, subsBack] = await Promise.all([
      DS.functions.countDrawingVersionsMulti(projectIds, ['pending_l1'], stream),
      countWithScope(
        `SELECT COUNT(*) cnt FROM issues
          WHERE issue_type IN ('rfi','design') AND status IN ('open','in_progress'){SCOPE}`,
        [], projectIds
      ),
      countWithScope(
        "SELECT COUNT(*) cnt FROM submittals WHERE status='resubmit_required'{SCOPE}",
        [], projectIds
      ),
    ]);
    push('drawings',   draws,    'Team drawings to review', 'drawings');
    push('issues',     rfis,     "Team RFIs open",          'issues');
    push('submittals', subsBack, 'Submittals returned',     'submittals');
  }

  // ─── Jr Architect / Services Engineer ──────────────────────────────
  // Own items only — RFIs assigned to me + my submittals returned.
  else if (role === 'jr_architect' || role === 'services_engineer') {
    const [rfis, subsBack] = await Promise.all([
      countWithScope(
        `SELECT COUNT(*) cnt FROM issues
          WHERE assigned_to = ? AND status IN ('open','in_progress'){SCOPE}`,
        [me.id], projectIds
      ),
      countWithScope(
        `SELECT COUNT(*) cnt FROM submittals
          WHERE submitted_by = ? AND status = 'resubmit_required'{SCOPE}`,
        [me.id], projectIds
      ),
    ]);
    push('issues',     rfis,     'RFIs assigned to me',    'issues');
    push('submittals', subsBack, 'My submittals returned', 'submittals');
  }

  // ─── Coordinator ───────────────────────────────────────────────────
  // MOM action items assigned to me + issues assigned to me.
  else if (role === 'coordinator') {
    const [actions, issues] = await Promise.all([
      countWithScope(
        `SELECT COUNT(ma.id) cnt FROM meeting_actions ma
           JOIN meetings m ON ma.meeting_id = m.id
          WHERE ma.assigned_to = ? AND ma.status IN ('pending','acknowledged','in_progress'){SCOPE}`,
        [me.id], projectIds, 'm.project_id'
      ),
      countWithScope(
        `SELECT COUNT(*) cnt FROM issues
          WHERE assigned_to = ? AND status IN ('open','in_progress'){SCOPE}`,
        [me.id], projectIds
      ),
    ]);
    push('meetings', actions, 'MOM actions assigned to me', 'meetings');
    push('issues',   issues,  'Issues assigned to me',      'issues');
  }

  // ─── Senior Site Manager ───────────────────────────────────────────
  // GRN approvals pending (below 5% budget threshold, auto-routed to them).
  // For simplicity, we count ALL pending GRNs scoped to their projects
  // and let frontend filter; an API-level 5%-budget filter needs the budget
  // figure per project which is a bigger query. Deferred.
  else if (role === 'senior_site_manager') {
    const grnsPending = await countWithScope(
      "SELECT COUNT(*) cnt FROM grns WHERE status='pending'{SCOPE}",
      [], projectIds
    );
    push('grn', grnsPending, 'GRNs to sign off', 'grn');
  }

  // ─── Site Manager ──────────────────────────────────────────────────
  // No Needs You — they have 📋 Today's Report pinned instead. That surface
  // is built in Item 10 (Daily Report Submission). For now, return empty
  // so the frontend hides the Needs You section for site managers.
  // (Frontend will render a separate Today's Report pinned section.)

  // ─── Other roles (principal, design_principal, finance_admin, audit,
  //     trainee, detailing) ─────────────────────────────────────────────
  // Principal + Design Principal have the Pending tab (Item 6), not a
  // pinned Needs You section. Others don't need one.

  const total = items.reduce((s, i) => s + (i.count || 0), 0);
  res.json({ role, total, items });
}));

module.exports = router;
