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
    const isPrincipal = PRINCIPALS.includes(me.role);
    const wants = ROLE_CATEGORIES[me.role] || [];

    // Resolve project scope. Principals → all active. Others → their assignments.
    let scopedProjectIds = null;
    if (!isPrincipal) {
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

    // Build the project filter clause + params for non-principals.
    // Principals: empty clause (no filter).
    const projFilter = isPrincipal ? '' : ' AND project_id IN (?)';
    const projParams = isPrincipal ? []  : [scopedProjectIds];

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
       WHERE tu.is_flagged = 1${projFilter ? ' AND tu.project_id IN (?)' : ''}
       ORDER BY tu.created_at DESC`,
      projParams
    );

    // Pending approvals (drift acks etc — only relevant to PMC + principals,
    // already filtered by ROLE_CATEGORIES)
    const pendingApprovals = await fetchIfWanted('pending_approvals',
      `SELECT ar.id, ar.request_type, ar.title, ar.drift_days, ar.raised_at,
         ar.raised_by, ar.project_id
       FROM wa_pending_actions ar
       WHERE ar.status = 'pending' AND ar.channel IN ('app','both')${projFilter ? ' AND ar.project_id IN (?)' : ''}
       ORDER BY ar.raised_at ASC`,
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
    const projectsFilter = isPrincipal
      ? "WHERE p.status = 'active'"
      : "WHERE p.status = 'active' AND p.id IN (?)";
    const [projects] = await db.query(
      `SELECT p.id, p.code, p.name, p.status, p.r0_end_date,
         COUNT(DISTINCT dq.id) AS open_queries,
         COUNT(DISTINCT tu.id) AS open_flags,
         COUNT(DISTINCT cn.id) AS open_changes,
         ANY_VALUE(sv.drift_days) AS drift_days,
         ANY_VALUE(sv.label)      AS schedule_version
       FROM projects p
       LEFT JOIN issues dq ON dq.project_id = p.id AND dq.status != 'closed'
       LEFT JOIN task_updates tu    ON tu.project_id = p.id AND tu.is_flagged = 1
       LEFT JOIN change_notices cn  ON cn.project_id = p.id AND cn.status NOT IN ('approved','rejected')
       LEFT JOIN schedule_versions sv ON sv.project_id = p.id AND sv.is_current = 1
       ${projectsFilter}
       GROUP BY p.id`,
      isPrincipal ? [] : [scopedProjectIds]
    );

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

module.exports = router;
