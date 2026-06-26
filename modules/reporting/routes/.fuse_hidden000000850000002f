// routes/acc-summary.js — accordion badge counts + preview items
//
// GET /api/needs-you/acc-summary/:projectId
//   Returns per-tab status counts for accordion badge rendering.
//
// GET /api/needs-you/acc-preview/:tabKey/:projectId
//   Returns up to 3 preview items for an expanded accordion item,
//   plus optional primaryAction and emailAction (deliberate, labelled).
//
// Design principle: emailAction is ALWAYS a deliberate separate action.
// It is NEVER triggered automatically by any status change.

const express = require('express');
const router = express.Router();
const db = require('../../../middleware/db');
const { requireAuth, requireProjectScope } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');

router.use(requireAuth);

// ── BADGE COUNTS ─────────────────────────────────────────────────────────
router.get('/acc-summary/:projectId', requireProjectScope(r => r.params.projectId),
  asyncHandler(async (req, res) => {
    const pid = parseInt(req.params.projectId);
    const role = req.session.user.role;
    const uid  = req.session.user.id;
    const items = [];

    // Helper: push an item
    const add = (key, meta, badgeText, badgeColour = 'grey') =>
      items.push({ key, meta, badge_text: badgeText, badge_colour: badgeColour });

    // Reports
    const [rptRows] = await db.query(
      `SELECT COUNT(*) AS n FROM daily_reports
       WHERE project_id=? AND status='pending_review'
         AND NOW() < TIMESTAMPADD(DAY, 2, report_date)`, [pid]);
    const rptPending = rptRows[0]?.n || 0;
    add('reports',
      rptPending ? `${rptPending} pending review` : 'Up to date',
      rptPending ? String(rptPending) : '✓',
      rptPending ? 'amber' : 'green');

    // Issues
    const [issRows] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN DATEDIFF(NOW(),raised_at)>7 THEN 1 ELSE 0 END) AS overdue
       FROM issues WHERE project_id=? AND status IN ('open','in_progress')`, [pid]);
    const issTotal   = issRows[0]?.total || 0;
    const issOverdue = issRows[0]?.overdue || 0;
    add('issues',
      issTotal ? `${issTotal} open${issOverdue ? ` · ${issOverdue} overdue` : ''}` : 'No open issues',
      issTotal ? String(issTotal) : '✓',
      issOverdue ? 'red' : issTotal ? 'amber' : 'green');

    // Labour
    const today = new Date().toISOString().slice(0,10);
    const [labRows] = await db.query(
      `SELECT COUNT(*) AS n FROM labour_register
       WHERE project_id=? AND register_date=?`, [pid, today]);
    const labLogged = labRows[0]?.n || 0;
    add('labour',
      labLogged ? `Logged today` : 'Not logged today',
      labLogged ? '✓' : '!',
      labLogged ? 'green' : 'amber');

    // GRN
    const [grnRows] = await db.query(
      `SELECT COUNT(*) AS n FROM grns
       WHERE project_id=? AND status='pending'`, [pid]);
    const grnPending = grnRows[0]?.n || 0;
    add('grn',
      grnPending ? `${grnPending} pending` : 'None pending',
      grnPending ? String(grnPending) : '—',
      grnPending ? 'amber' : 'grey');

    // Tasks — schedule_tasks belongs to design-services; there is no 'status'
    // column. Count tasks from the current schedule version for this project.
    const [taskRows] = await db.query(
      `SELECT COUNT(*) AS n FROM schedule_tasks st
       JOIN schedule_versions sv ON st.schedule_version_id = sv.id
       WHERE st.project_id = ? AND sv.is_current = 1`, [pid]
    ).catch(() => [[{n:0}]]);
    add('tasks',
      `${taskRows[0]?.n || 0} active`,
      String(taskRows[0]?.n || 0), 'grey');

    // Drawings
    const DS = require('../../design-services/contract');
    const dwgPending = await DS.functions.countDrawingVersions(pid, ['pending_l1','pending_l2']);
    add('drawings',
      dwgPending ? `${dwgPending} pending review` : 'All reviewed',
      dwgPending ? String(dwgPending) : '✓',
      dwgPending ? 'amber' : 'green');

    // Register
    const regIssued = await DS.functions.countDrawingVersions(pid, ['issued']);
    add('register', `${regIssued} issued`, '—', 'grey');

    // Meetings
    const [momRows] = await db.query(
      `SELECT COUNT(*) AS n FROM meetings
       WHERE project_id=? AND status='pending_mom'`, [pid]).catch(() => [[{n:0}]]);
    add('meetings',
      momRows[0]?.n ? `${momRows[0]?.n} MOM pending` : 'No MOMs pending',
      momRows[0]?.n ? String(momRows[0]?.n) : '—',
      momRows[0]?.n ? 'amber' : 'grey');

    // Project — single fetch, reused for schedule and budget cards below
    const Onboarding = require('../../onboarding/contract');
    const proj = await Onboarding.functions.getProject(pid);

    // Schedule
    add('schedule',
      proj?.status === 'active' ? 'Active' : 'See project',
      '—', 'grey');

    // Payments
    const [prRows] = await db.query(
      `SELECT COUNT(*) AS n FROM payment_requests
       WHERE project_id=? AND status NOT IN ('paid','cancelled')`, [pid]);
    const prPending = prRows[0]?.n || 0;
    add('payments',
      prPending ? `${prPending} pending` : 'None pending',
      prPending ? String(prPending) : '—',
      prPending ? 'red' : 'grey');

    // Engagements
    const [engRows] = await db.query(
      `SELECT COUNT(*) AS n FROM vendor_engagements
       WHERE project_id=? AND is_active=1`, [pid]);
    add('engagements', `${engRows[0]?.n || 0} active`, String(engRows[0]?.n || 0), 'grey');

    // Budget
    add('budget',
      proj?.contract_value
        ? `₹${(proj.contract_value/100000).toFixed(1)}L contract`
        : 'Not set',
      '—', 'grey');

    // Materials
    const [matRows] = await db.query(
      `SELECT COUNT(*) AS n FROM material_requests
       WHERE project_id=? AND status='overdue'`, [pid]).catch(() => [[{n:0}]]);
    add('materials',
      matRows[0]?.n ? `${matRows[0]?.n} overdue` : 'None overdue',
      matRows[0]?.n ? String(matRows[0]?.n) : '—',
      matRows[0]?.n ? 'amber' : 'grey');

    // Client contract
    add('client_boq', 'Fee schedule', '—', 'grey');

    // Vendor allocation
    add('boq_mapping', 'BOQ mapping', '—', 'grey');

    res.json({ items });
  })
);

// ── PREVIEW ITEMS ─────────────────────────────────────────────────────────
router.get('/acc-preview/:tabKey/:projectId?',
  asyncHandler(async (req, res) => {
    const { tabKey, projectId } = req.params;
    const pid = projectId ? parseInt(projectId) : null;
    const uid = req.session.user.id;

    // Validate project scope if scoped
    if (pid) {
      const role = req.session.user.role;
      const FIRM_WIDE = ['principal','design_principal','pmc_head','design_head',
                         'services_head','finance_admin','audit','it_admin'];
      if (!FIRM_WIDE.includes(role)) {
        const [rows] = await db.query(
          `SELECT id FROM project_assignments WHERE project_id=? AND user_id=? AND is_active=1`,
          [pid, uid]);
        if (!rows.length) return res.status(403).json({ error: 'Not assigned to this project' });
      }
    }

    let items = [], primaryAction = null, emailAction = null;

    try {
      switch (tabKey) {
        case 'issues': {
          const [rows] = await db.query(
            `SELECT id, issue_number, issue_type, title, status,
                    DATEDIFF(NOW(),raised_at) AS age_days
             FROM issues WHERE project_id=? AND status IN ('open','in_progress')
             ORDER BY age_days DESC LIMIT 3`, [pid]);
          items = rows.map(r => ({
            title: r.title,
            meta:  `${r.issue_type?.toUpperCase()} · ${r.age_days} days old`,
            tag:   r.age_days > 7 ? 'Overdue' : r.status === 'in_progress' ? 'In progress' : 'Open',
            tag_colour: r.age_days > 7 ? 'red' : 'amber',
          }));
          primaryAction = { label: 'Raise issue', tab: 'issues' };
          break;
        }
        case 'reports': {
          const [rows] = await db.query(
            `SELECT id, report_date, status, ai_flag_reason
             FROM daily_reports WHERE project_id=?
             ORDER BY report_date DESC LIMIT 3`, [pid]);
          items = rows.map(r => ({
            title: `Report — ${r.report_date}`,
            meta:  r.status?.replace(/_/g,' '),
            tag:   r.status === 'flagged' ? 'Flagged' : r.status === 'approved' ? 'Approved' : 'Pending',
            tag_colour: r.status === 'flagged' ? 'red' : r.status === 'approved' ? 'green' : 'amber',
          }));
          primaryAction = { label: 'Submit today', tab: 'reports' };
          break;
        }
        case 'grn': {
          const [rows] = await db.query(
            `SELECT g.id, g.grn_number, g.description, g.delivery_date, g.status
             FROM grns g WHERE g.project_id=? AND g.status='pending'
             ORDER BY g.delivery_date LIMIT 3`, [pid]);
          items = rows.map(r => ({
            title: r.grn_number || 'GRN',
            meta:  `${r.description || ''} · ${r.delivery_date || ''}`,
            tag:   'Pending', tag_colour: 'amber',
          }));
          primaryAction = { label: 'Raise GRN', tab: 'grn' };
          break;
        }
        case 'drawings': {
          const [rows] = await db.query(
            `SELECT d.drawing_number, d.drawing_name, dv.revision, dv.status
             FROM drawing_versions dv JOIN drawings d ON dv.drawing_id=d.id
             WHERE d.project_id=? AND dv.status IN ('pending_l1','pending_l2')
             ORDER BY dv.id DESC LIMIT 3`, [pid]);
          items = rows.map(r => ({
            title: `${r.drawing_number} — ${r.drawing_name}`,
            meta:  `Rev ${r.revision} · ${r.status?.replace(/_/g,' ')}`,
            tag:   'Pending review', tag_colour: 'amber',
          }));
          primaryAction = { label: 'Review', tab: 'drawings' };
          break;
        }
        case 'payments': {
          const [rows] = await db.query(
            `SELECT id, amount_requested, payment_type, status, vendor_id
             FROM payment_requests
             WHERE project_id=? AND status NOT IN ('paid','cancelled')
             ORDER BY id DESC LIMIT 3`, [pid]);
          const Onboarding = require('../../onboarding/contract');
          const accVendors = await Onboarding.functions.getVendorsByIds(rows.map(r => r.vendor_id));
          items = rows.map(r => ({
            title: accVendors.get(r.vendor_id)?.vendor_name || 'Vendor',
            meta:  `${r.payment_type?.replace(/_/g,' ')} · ₹${Number(r.amount_requested).toLocaleString('en-IN')}`,
            tag:   r.status?.replace(/_/g,' '), tag_colour: 'amber',
          }));
          primaryAction = { label: 'Approve', tab: 'payments' };
          break;
        }
        default:
          break;
      }
    } catch (_e) { /* return empty preview gracefully */ }

    res.json({ items, primary_action: primaryAction, email_action: emailAction });
  })
);

module.exports = router;
