// routes/daily-reports.js — Site Manager daily report submission
// (Sprint 3 Item 10 of the nav redesign.)
//
// Flow:
//   1. Site Manager (or Senior Site Manager) opens the Work bucket.
//       The pinned 📋 Today's Report card shows submission status.
//   2. Site Manager submits end-of-day (target: 6pm) with notes + head-counts
//       captured implicitly by the day's activity (tasks marked, photos,
//       issues raised, labour logged).
//   3. Report lands with status='pending_review'. Overnight, PMC Head corrects
//       in the Reports tab.
//   4. 6am cron publishes approved reports to principals + design/services
//       heads (out of scope for this MVP — see services/daily-digest.js for
//       the existing publish job skeleton).
//
// Endpoints:
//   GET  /api/daily-reports/:project_id/today   — today's status for current user
//   POST /api/daily-reports/:project_id/submit  — create or update today's report
//
// Who can submit:
//   site_manager, senior_site_manager — only for projects they're assigned to
// Who can read:
//   All project roles (via REPORT_READER_ROLES pattern from routes/reports.js)

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, PROJECT_SCOPED_ROLES, requireProjectScope } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router  = express.Router();

// Submitters for Item 10 — expand later if additional site roles need to submit.
const SUBMITTER_ROLES = ['site_manager', 'senior_site_manager'];

// ── Write-guard helper ──────────────────────────────────────────────────
// Daily reports become immutable in any of these cases:
//   1. status is 'auto_locked' (cron fired at T+2 days 00:00 IST)
//   2. weekly_reports row for the same week is 'approved' or 'sent'
//   3. PMC action window closed (>= T+2 days after report_date)
//
// Returns { ok: true } or { ok: false, reason: string, http: number }.
//
// `actor` controls which checks apply:
//   - 'submit'  — site manager creating/editing. Skip PMC-window check
//                 (site mgr can only submit today's row anyway).
//   - 'pmc'     — PMC approving/flagging. All three checks.
async function checkDailyWritable(report, actor) {
  if (report.status === 'auto_locked') {
    return { ok: false, http: 409, reason: 'Report auto-locked (deadline passed without action)' };
  }

  // Weekly publish lock — find a weekly_report whose 7-day window covers report_date
  const [[wkly]] = await db.query(
    `SELECT id, status FROM weekly_reports
       WHERE project_id = ?
         AND ? BETWEEN DATE_SUB(week_ending, INTERVAL 6 DAY) AND week_ending
       ORDER BY status='sent' DESC, status='approved' DESC
       LIMIT 1`,
    [report.project_id, report.report_date]
  );
  if (wkly && (wkly.status === 'sent' || wkly.status === 'approved')) {
    return { ok: false, http: 409,
      reason: `Weekly report for this week is ${wkly.status}; daily reports for the week are locked` };
  }

  if (actor === 'pmc') {
    // PMC has until 00:00 IST T+2 days after report_date (Tuesday → Thu 00:00).
    const [[chk]] = await db.query(
      `SELECT NOW() < TIMESTAMPADD(DAY, 2, ?) AS in_window`,
      [report.report_date]
    );
    if (!chk.in_window) {
      return { ok: false, http: 409, reason: 'PMC action window closed (T+2 days after report date)' };
    }
  }

  return { ok: true };
}

// Today's date in IST (project reality is Bengaluru — avoid UTC date shift
// when it crosses midnight IST).
function todayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString().slice(0, 10);  // 'YYYY-MM-DD'
}

// ── GET today's report status for the current user ─────────────────────
// Returns whichever of these applies:
//   - not_submitted: user hasn't submitted yet today
//   - submitted:     row exists with status='pending_review'
//   - approved:      PMC approved
//   - flagged:       PMC flagged with a reason
router.get('/:project_id/today',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });

    // Project scope check — site roles must be assigned to this project.
    // Firm-wide roles (principal, PMC Head etc.) can query any project.
    if (SUBMITTER_ROLES.includes(me.role)) {
      const assigned = (me.projects || []).some(p => p.id === projectId);
      if (!assigned) return res.status(403).json({ error: 'Not assigned to this project' });
    }

    const today = todayIST();
    // For submitter roles, return THEIR specific row. For viewer roles,
    // return whatever was submitted today (site manager row).
    let row = null;
    if (SUBMITTER_ROLES.includes(me.role)) {
      const [rows] = await db.query(
        `SELECT id, status, overall_notes, submitted_at, approved_at, flag_reason, ai_flag_reason
           FROM daily_reports
          WHERE project_id = ? AND report_date = ? AND site_manager_id = ?
          LIMIT 1`,
        [projectId, today, me.id]
      );
      row = rows[0];
    } else {
      const [rows] = await db.query(
        `SELECT id, status, overall_notes, submitted_at, approved_at, flag_reason, ai_flag_reason,
                site_manager_id
           FROM daily_reports
          WHERE project_id = ? AND report_date = ?
          ORDER BY submitted_at DESC
          LIMIT 1`,
        [projectId, today]
      );
      row = rows[0];
      if (row?.site_manager_id) {
        const Auth = require('../../auth/contract');
        const users = await Auth.functions.getUsers([row.site_manager_id]);
        row.site_manager_name = users.get(row.site_manager_id)?.full_name || null;
      }
    }

    if (!row) {
      return res.json({ state: 'not_submitted', date: today });
    }
    return res.json({
      state: row.status,  // 'pending_review' | 'approved' | 'flagged'
      date:  today,
      id:    row.id,
      notes: row.overall_notes,
      submitted_at: row.submitted_at,
      approved_at:  row.approved_at,
      flag_reason:  row.flag_reason || row.ai_flag_reason || null,
      site_manager_id:   row.site_manager_id,
      site_manager_name: row.site_manager_name,
    });
  })
);

// ── POST submit or re-submit today's report ────────────────────────────
// Site manager can re-submit before PMC approves — ON DUPLICATE KEY updates
// the existing row. Once approved, further submissions are blocked.
router.post('/:project_id/submit',
  requireAuth, requireProjectScope(),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const projectId = parseInt(req.params.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });
    if (!SUBMITTER_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'Only site managers can submit daily reports' });
    }
    const assigned = (me.projects || []).some(p => p.id === projectId);
    if (!assigned) return res.status(403).json({ error: 'Not assigned to this project' });

    const notes = (req.body?.notes || '').toString().trim();
    if (notes.length > 5000) {
      return res.status(400).json({ error: 'Notes must be under 5000 characters' });
    }
    const today = todayIST();

    // Block re-submission after approval
    const [[existing]] = await db.query(
      `SELECT id, status FROM daily_reports
        WHERE project_id = ? AND report_date = ? AND site_manager_id = ?
        LIMIT 1`,
      [projectId, today, me.id]
    );
    if (existing && existing.status === 'approved') {
      return res.status(400).json({
        error: 'Today\'s report already approved. Changes now require PMC Head.',
        id: existing.id,
      });
    }

    // Weekly-publish lock — even if site mgr is in their edit window, the
    // weekly report for today's week may already be approved or sent. Reject.
    // (Auto-locked check is no-op here since the report is being created today,
    // and auto_locked only fires at T+2 days.)
    const writeCheck = await checkDailyWritable(
      { project_id: projectId, report_date: today, status: existing?.status || 'pending_review' },
      'submit'
    );
    if (!writeCheck.ok) {
      return res.status(writeCheck.http).json({ error: writeCheck.reason });
    }

    // ON DUPLICATE KEY UPDATE — keeps the original submitted_at but
    // refreshes overall_notes. Reset to pending_review if it was flagged.
    const [result] = await db.query(
      `INSERT INTO daily_reports
         (project_id, report_date, site_manager_id, source, overall_notes, status, submitted_at)
       VALUES (?, ?, ?, 'app', ?, 'pending_review', NOW())
       ON DUPLICATE KEY UPDATE
         overall_notes = VALUES(overall_notes),
         status        = 'pending_review',
         submitted_at  = NOW(),
         flag_reason   = NULL,
         flagged_by    = NULL,
         flagged_at    = NULL`,
      [projectId, today, me.id, notes || null]
    );

    const id = result.insertId || (existing && existing.id) || null;
    audit.log({ userId: me.id, action: 'daily_report.submit',
      entityType: 'daily_reports', entityId: id,
      details: { project_id: projectId, report_date: today, was_resubmit: !!existing }, req });

    // Trigger poll to PMC's project internal room for approval.
    // Non-blocking: gate failure logs + drops; PMC can still approve via PWA.
    if (id) {
      try {
        const signoffGate = require('../../../services/signoff-gate');
        await signoffGate.triggerSignoff(
          'daily_report',
          id,
          projectId,
          {
            question: `${today} daily report submitted — ${me.full_name}. Approve?`,
            triggeredBy: me.id,
          }
        );
      } catch (gateErr) {
        console.warn('[daily-reports.submit signoff-gate]', gateErr.message);
      }
    }

    res.json({ ok: true, id, date: today, state: 'pending_review' });
  })
);

// ── GET /:project_id — list reports for this project (PMC Head approval view) ────
// Returns ALL reports (most recent first) with pending_review first.
// Reader roles: anyone with Reports tab in their nav (PMC, Principal, DP, Heads,
// Site Mgr, Senior Site Mgr, Audit). Frontend filters for pending/approved/flagged.
const READER_ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'senior_site_manager','site_manager','coordinator','team_lead','audit'
];
// Roles whose visibility is gated by the site team's soft deadline.
// They see a daily report only after the site manager's edit window has
// closed (06:00 IST the day after report_date). Until then, only PMC and
// site managers see the report — heads and principals wait.
//
// Implementation note: the connection runs at IST timezone (+05:30, set
// in middleware/db.js). report_date is a DATE; TIMESTAMPADD(HOUR, 30, date)
// equals 06:00 the next day. Once NOW() crosses that, the report becomes
// visible to these roles.
const POST_DEADLINE_ONLY_ROLES = [
  'design_head','services_head','principal','design_principal'
];

router.get('/:project_id',
  requireAuth,
  requireProjectScope(),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!READER_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    const projectId = parseInt(req.params.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });

    // Deadline filter for heads/principals: report visible only after
    // 06:00 IST the day after report_date. PMC + site managers + audit + coord
    // + team_lead see all reports in scope.
    const deadlineFilter = POST_DEADLINE_ONLY_ROLES.includes(me.role)
      ? ' AND NOW() >= TIMESTAMPADD(HOUR, 30, report_date)'
      : '';

    const [reports] = await db.query(
      `SELECT id, report_date, status, source, overall_notes,
              submitted_at, approved_at, flag_reason, flagged_at,
              site_manager_id, approved_by, flagged_by
       FROM daily_reports
       WHERE project_id = ?${deadlineFilter}
       ORDER BY FIELD(status,'pending_review','flagged','approved'),
                report_date DESC, id DESC
       LIMIT 50`,
      [projectId]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      reports.flatMap(r => [r.site_manager_id, r.approved_by, r.flagged_by].filter(Boolean))
    );
    reports.forEach(r => {
      r.site_manager_name = users.get(r.site_manager_id)?.full_name || null;
      r.approved_by_name  = users.get(r.approved_by)?.full_name     || null;
      r.flagged_by_name   = users.get(r.flagged_by)?.full_name      || null;
    });
    res.json({ reports });
  })
);

// ── POST /:id/approve — PMC approves a single daily report ──────────────
const APPROVER_ROLES = ['pmc_head','principal','design_principal'];
router.post('/:id/approve',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!APPROVER_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'PMC Head / Principal only' });
    }
    const id = parseInt(req.params.id, 10);
    const [[row]] = await db.query(
      'SELECT id, status, project_id, report_date FROM daily_reports WHERE id = ?',
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Report not found' });
    if (row.status === 'approved') {
      return res.status(400).json({ error: 'Already approved' });
    }
    const writeCheck = await checkDailyWritable(row, 'pmc');
    if (!writeCheck.ok) {
      return res.status(writeCheck.http).json({ error: writeCheck.reason });
    }
    const sm = require('../../../services/state-machines').dailyReport;
    try {
      await sm.transition({
        id, from: row.status, to: 'approved',
        extraCols: {
          approved_by: me.id, approved_at: new Date(),
          flag_reason: null, flagged_by: null, flagged_at: null,
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'daily_report.approve',
      entityType: 'daily_reports', entityId: id,
      details: { from: row.status, to: 'approved' }, req });
    res.json({ success: true, id });
  })
);

// ── POST /:project_id/batch-approve — PMC approves all pending_review at once ─
router.post('/:project_id/batch-approve',
  requireAuth, requireProjectScope(),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!APPROVER_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'PMC Head / Principal only' });
    }
    const projectId = parseInt(req.params.project_id, 10);
    if (!projectId) return res.status(400).json({ error: 'project_id required' });

    // Find eligible reports first. Filter is complex (project + status set +
    // age window + not-locked-by-an-approved-weekly-report); state-machine
    // bulk only filters on (id, from). Run the SELECT, then transition.
    const [eligible] = await db.query(
      `SELECT dr.id, dr.status FROM daily_reports dr
       WHERE dr.project_id = ?
         AND dr.status IN ('pending_review','flagged')
         AND NOW() < TIMESTAMPADD(DAY, 2, dr.report_date)
         AND NOT EXISTS (
           SELECT 1 FROM weekly_reports wr
            WHERE wr.project_id = dr.project_id
              AND dr.report_date BETWEEN DATE_SUB(wr.week_ending, INTERVAL 6 DAY)
                                    AND wr.week_ending
              AND wr.status IN ('approved','sent')
         )`,
      [projectId]
    );

    let approvedCount = 0;
    if (eligible.length) {
      const sm = require('../../../services/state-machines').dailyReport;
      const extraCols = {
        approved_by: me.id, approved_at: new Date(),
        flag_reason: null, flagged_by: null, flagged_at: null,
      };
      // Two batches — bulk transition takes a single from-state per call
      const pendingIds = eligible.filter(r => r.status === 'pending_review').map(r => r.id);
      const flaggedIds = eligible.filter(r => r.status === 'flagged').map(r => r.id);
      if (pendingIds.length) {
        const r = await sm.transitionMany({ ids: pendingIds, from: 'pending_review', to: 'approved', extraCols });
        approvedCount += r.affected;
      }
      if (flaggedIds.length) {
        const r = await sm.transitionMany({ ids: flaggedIds, from: 'flagged', to: 'approved', extraCols });
        approvedCount += r.affected;
      }
    }
    audit.log({ userId: me.id, action: 'daily_report.batch_approve',
      entityType: 'daily_reports', entityId: null,
      details: { project_id: projectId, approved: approvedCount }, req });
    res.json({ success: true, approved: approvedCount });
  })
);

// ── POST /:id/flag — PMC flags a report with a reason (needs site mgr rework) ─
router.post('/:id/flag',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    if (!APPROVER_ROLES.includes(me.role)) {
      return res.status(403).json({ error: 'PMC Head / Principal only' });
    }
    const id = parseInt(req.params.id, 10);
    const reason = (req.body?.reason || '').toString().trim();
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: 'Flag reason required (min 5 chars)' });
    }
    const [[row]] = await db.query(
      'SELECT id, status, project_id, report_date FROM daily_reports WHERE id = ?',
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Report not found' });
    if (row.status === 'approved') {
      return res.status(400).json({ error: 'Cannot flag an already-approved report' });
    }
    const writeCheck = await checkDailyWritable(row, 'pmc');
    if (!writeCheck.ok) {
      return res.status(writeCheck.http).json({ error: writeCheck.reason });
    }
    const sm = require('../../../services/state-machines').dailyReport;
    try {
      await sm.transition({
        id, from: row.status, to: 'flagged',
        extraCols: { flag_reason: reason, flagged_by: me.id, flagged_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }
    audit.log({ userId: me.id, action: 'daily_report.flag',
      entityType: 'daily_reports', entityId: id,
      details: { from: row.status, to: 'flagged', reason }, req });
    res.json({ success: true, id });
  })
);

module.exports = router;
