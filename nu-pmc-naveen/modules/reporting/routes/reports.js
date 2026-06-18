// routes/reports.js
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const ai      = require('../../../services/ai');
const notif   = require('../../../services/notifications');
const { requireAuth, requirePrincipal, requirePMC, requireRole, requireProjectScope } = require('../../../middleware/auth');

// Reports are shared broadly within the team (everyone except trainee).
// Narrower restriction would need project-membership-based gating — deferred.
const REPORT_READER_ROLES = [
  'principal','design_principal','pmc_head','design_head','services_head',
  'detailing_head','coordinator','senior_site_manager','site_manager',
  'services_engineer','finance_admin','team_lead','jr_architect','detailing',
];
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router  = express.Router();

// GET /api/reports/:project_id — list all weekly reports
router.get('/:project_id', requireAuth, requireRole(...REPORT_READER_ROLES), asyncHandler(async (req, res) => {
    const [reports] = await db.query(
      `SELECT * FROM weekly_reports WHERE project_id = ? ORDER BY week_ending DESC`,
      [req.params.project_id]
    );
    // Hydrate user names via Auth contract (bulk, avoids N+1).
    const Auth = require('../../auth/contract');
    const userIds = reports.flatMap(r => [r.drafted_by, r.approved_by].filter(Boolean));
    const users = await Auth.functions.getUsers(userIds);
    reports.forEach(r => {
      r.drafted_by_name  = users.get(r.drafted_by)?.full_name || null;
      r.approved_by_name = users.get(r.approved_by)?.full_name || null;
    });
    res.json({ reports });
  }));

// GET /api/reports/:project_id/generate — auto-generate this week's report data
router.get('/:project_id/generate', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const pid   = req.params.project_id;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (6 - dayOfWeek)); // Saturday
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);

    const DS   = require('../../design-services/contract');
    const Site = require('../../site/contract');

    // Schedule progress by trade (design-services owns schedule tables)
    const tradeProgress = await DS.functions.getScheduleProgressByTrade(pid);

    // Photos this week (Site owns project_photos)
    const photos = await Site.functions.getRecentPhotos(
      pid, weekStart.toLocaleDateString('en-CA'), 20
    );

    // Open flags on task updates (design-services)
    const flags = await DS.functions.getFlaggedTaskUpdates(pid);

    // Open design-issues with drawing info (Site, which JOINs to DS internally)
    const queries = await Site.functions.getOpenDesignIssuesWithDrawings(pid);

    // Material status summary (design-services)
    const materials = await DS.functions.getMaterialRequestsWithBOQ(pid);

    // Week number
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const weekNumber  = Math.ceil((((today - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);

    res.json({
      week_ending:    weekEnd.toLocaleDateString('en-CA'),
      week_number:    weekNumber,
      trade_progress: tradeProgress,
      photos,
      flags,
      queries,
      materials,
    });

  }));

// POST /api/reports/:project_id — save draft
router.post('/:project_id', requireAuth, requireProjectScope(), requirePMC, async (req, res) => {
  try {
    const { WeeklyReportDraft, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(WeeklyReportDraft, req, res);
    if (!body) return;
    const { week_ending, week_number, summary, issues_for_client, photo_ids } = body;

    const [result] = await db.query(
      `INSERT INTO weekly_reports (project_id, week_ending, week_number, summary, issues_for_client, drafted_by)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE summary=VALUES(summary), issues_for_client=VALUES(issues_for_client), updated_at=NOW()`,
      [req.params.project_id, week_ending, week_number, summary, issues_for_client, req.session.user.id]
    );

    const reportId = result.insertId || result.insertId;

    // Link photos if provided
    if (photo_ids?.length) {
      for (const pid of photo_ids) {
        await db.query(
          'INSERT IGNORE INTO weekly_report_photos (weekly_report_id, photo_id) VALUES (?,?)',
          [reportId, pid]
        );
      }
    }

    // Create approval request
    // In-app approval notification — weekly report ready for PMC review
    try {
      const pmcs = await users.usersByRoleOnProject('pmc_head', req.params.project_id);
      for (const p of pmcs) {
        await notif.notify(p.id, 'weekly_report_ready', `Weekly Report — Week ${week_number} ready for review`);
      }
    } catch (e) { console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message); }

    // AI drag analysis — runs inline, result returned to client for PMC to see while drafting
    try {
      const ai = require('../../../services/ai');

      // Get schedule data for this project (via design-services contract)
      const DS = require('../../design-services/contract');
      const schedTasks = await DS.functions.getTasksWithLatestUpdate(req.params.project_id);

      // Calculate planned % per task
      const now = new Date();
      const schedData = schedTasks.map(t => {
        const start    = new Date(t.start_date);
        const end      = new Date(t.end_date);
        const duration = (end - start) / 86400000;
        const elapsed  = Math.max(0, Math.min(duration, (now - start) / 86400000));
        const planned  = duration > 0 ? Math.min(100, (elapsed/duration)*100) : 0;
        return { trade: t.trade, task: t.task_name, planned: planned.toFixed(1), actual: parseFloat(t.actual_pct) };
      });

      const proj = { name: await users.projectName(req.params.project_id) };
      const dragResult = await ai.analyseWeeklyDrag(req.body, schedData, proj?.name||'Project');

      if (dragResult?.drag_detected && dragResult.flags?.length) {
        // Hold report — flag to PMC
        const flagSummary = dragResult.flags.map(f =>
          f.trade + ' ' + f.gap.toFixed(0) + '% behind' + (f.vendor ? ' - ' + f.vendor : '')
        ).join(', ');

        // AI drag detected — set flag columns only; status stays 'draft'.
        // WHERE status='draft' is the concurrency guard (CAS), not a state transition.
        await db.query(
          'UPDATE weekly_reports SET ai_drag_detected=1, ai_drag_summary=? WHERE id=? AND status=?',
          [dragResult.summary, reportId, 'draft']
        );

        // WhatsApp to PMC with drag flag — requires mitigation note
        const Auth = require('../../auth/contract');
        const pmcHeads = await Auth.functions.getPmcHeadsForProject(req.params.project_id);

        const body = 'Weekly report held — drag detected\n' +
          flagSummary.substring(0, 80) + '\n\nAdd mitigation note before submitting.';
        // Matrix message to project's internal room with PWA deep link for mitigation note.
        // Community destination — all PMC heads in the room see it.
        try {
          const matrixAdapter = require('../../../services/matrix-adapter');
          const pwaUrl = `${process.env.PWA_BASE_URL}/app/reports/weekly/${reportId}/mitigation`;
          const roomId = await matrixAdapter.getProjectRoomId(req.params.project_id, 'internal');
          if (roomId) {
            await matrixAdapter.sendText({
              roomId,
              body: `⚠️ Weekly report draft — drag detected. ${flagSummary.substring(0, 80)}. Add mitigation note before submitting: ${pwaUrl}`,
            });
          }
        } catch (matrixErr) {
          console.warn('[reports.draft] Matrix drag-alert failed:', matrixErr.message);
        }

        // Return drag data inline — PMC sees it in the drafting screen
        // Report saved as draft — PMC adds mitigation note before submitting
        return res.json({
          success: true, id: reportId,
          drag_detected: true,
          drag_flags: dragResult.flags,
          drag_summary: dragResult.summary,
          message: 'Draft saved. Drag detected — add mitigation note before submitting.',
        });
      }
    } catch(_aiErr) { /* drag analysis failure non-blocking */ }

    res.json({ success: true, id: reportId });
  } catch (_err) { res.status(500).json({ error: 'Failed to save draft' }); }
});

// POST /api/reports/:id/approve — PMC Head approves weekly reports (not principal)
router.post('/:id/approve', requireAuth, requirePMC, async (req, res) => {
  try {
    const [[wr]] = await db.query('SELECT status FROM weekly_reports WHERE id = ?', [req.params.id]);
    if (!wr) return res.status(404).json({ error: 'Report not found' });

    const { weeklyReport: wrSM } = require('../../../services/state-machines');
    await wrSM.transition({
      id: parseInt(req.params.id), from: wr.status, to: 'approved',
      extraCols: { approved_by: req.session.user.id, approved_at: new Date() },
      audit: { userId: req.session.user.id, req },
    });
    // Notify principals in-app for visibility — not a gate
    const principals = await users.principals();
    for (const p of principals) {
      await notif.notify(p.id, 'weekly_report', 'Weekly report approved by PMC Head — available for review.');
    }
    res.json({ success: true, message: 'Report approved — Design Coordinator can now send to client.' });
  } catch (err) {
    if (err.code === 'INVALID_STATE_TRANSITION') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: 'Failed to approve report' });
  }
});

// POST /api/reports/:id/mark-sent — Design Coordinator marks as sent
router.post('/:id/mark-sent', requireAuth, requirePrincipal, async (req, res) => {
  try {
    const [[wr]] = await db.query('SELECT status FROM weekly_reports WHERE id = ?', [req.params.id]);
    if (!wr) return res.status(404).json({ error: 'Report not found' });

    const { weeklyReport: wrSM } = require('../../../services/state-machines');
    await wrSM.transition({
      id: parseInt(req.params.id), from: wr.status, to: 'sent',
      extraCols: { sent_by: req.session.user.id, sent_at: new Date() },
      audit: { userId: req.session.user.id, req },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'INVALID_STATE_TRANSITION') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: 'Failed to mark report as sent' });
  }
});

// POST /api/reports/:id/ack-anomaly — acknowledge an AI-flagged daily report anomaly
router.post('/:id/ack-anomaly', requireAuth, requirePMC, async (req, res) => {
  try {
    // The id here refers to a daily_reports row flagged by AI.
    // M4 Site owns daily_reports — go through its contract.
    const Site = require('../../site/contract');
    const r = await Site.functions.acknowledgeDailyReportAnomaly(req.params.id);
    if (!r.affected) return res.status(404).json({ error: 'Flagged report not found or already acknowledged' });
    audit.log({ userId: req.session.user.id, action: 'anomaly_acknowledged', entityType: 'daily_reports', entityId: req.params.id, req });
    res.json({ success: true });
  } catch (_err) { res.status(500).json({ error: 'Failed to ack anomaly' }); }
});

// GET /api/reports/:id/view — fetch full report detail
router.get('/:id/view', requireAuth, requireRole(...REPORT_READER_ROLES), asyncHandler(async (req, res) => {
    const [[report]] = await db.query(
      `SELECT * FROM weekly_reports WHERE id = ?`,
      [req.params.id]
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Hydrate cross-module fields via contracts
    const Onboarding = require('../../onboarding/contract');
    const Auth       = require('../../auth/contract');
    const [project, users] = await Promise.all([
      Onboarding.functions.getProject(report.project_id),
      Auth.functions.getUsers([report.submitted_by].filter(Boolean)),
    ]);
    report.project_name      = project?.name || null;
    report.submitted_by_name = users.get(report.submitted_by)?.full_name || null;

    res.json({ report });
  }));

// POST /api/reports/:project_id/weekly/upload — upload final signed weekly report
router.post('/:project_id/weekly/upload', requireAuth, requireProjectScope(), require('../../../middleware/upload').upload.single('report'), asyncHandler(async (req, res) => {
    const { week_ending, notes } = req.body;
    const file = req.file;
    if (!file || !week_ending) return res.status(400).json({ error: 'File and week_ending required' });

    // Check access — same as who can view
    const me = req.session.user;
    const Onboarding = require('../../onboarding/contract');
    const assigned = await Onboarding.functions.isUserAssignedToProject(me.id, req.params.project_id);
    if (!assigned && !['principal','design_principal'].includes(me.role)) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    await db.query(
      `INSERT INTO weekly_report_documents
       (project_id, week_ending, doc_type, uploaded_by, uploaded_at, file_path, notes)
       VALUES (?,?,'final',?,NOW(),?,?)`,
      [req.params.project_id, week_ending, me.id, file.path, notes||null]
    );
    res.json({ success: true, message: 'Final weekly report uploaded and stored.' });
  }));

// GET /api/reports/:project_id/weekly/documents — list all drafts and finals
router.get('/:project_id/weekly/documents', requireAuth, requireRole(...REPORT_READER_ROLES), asyncHandler(async (req, res) => {
    const [docs] = await db.query(
      `SELECT * FROM weekly_report_documents
       WHERE project_id = ?
       ORDER BY week_ending DESC, doc_type DESC`,
      [req.params.project_id]
    );
    // Bulk hydrate uploaded_by_name + generated_by_name
    const Auth = require('../../auth/contract');
    const userIds = docs.flatMap(d => [d.uploaded_by, d.generated_by].filter(Boolean));
    const users = await Auth.functions.getUsers(userIds);
    docs.forEach(d => {
      d.uploaded_by_name  = users.get(d.uploaded_by)?.full_name || null;
      d.generated_by_name = users.get(d.generated_by)?.full_name || null;
    });
    res.json({ documents: docs });
  }));

// PATCH /api/reports/weekly/:id/mitigation — PMC adds mitigation note to unblock drag-flagged report
router.patch('/weekly/:id/mitigation', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { mitigation_note } = req.body;
    if (!mitigation_note || mitigation_note.trim().length < 10) {
      return res.status(400).json({ error: 'Mitigation note required — minimum 10 characters' });
    }

    const [[report]] = await db.query(
      'SELECT id, project_id, ai_drag_detected FROM weekly_reports WHERE id=? AND status=?',
      [req.params.id, 'draft']
    );
    if (!report) return res.status(404).json({ error: 'Report not found or already submitted' });
    if (!report.ai_drag_detected) return res.status(400).json({ error: 'No drag flag on this report' });

    // Update mitigation columns (always), then transition state via state machine
    await db.query(
      `UPDATE weekly_reports SET
       mitigation_note=?, drag_acknowledged=1, drag_ack_by=?, drag_ack_at=NOW()
       WHERE id=?`,
      [mitigation_note.trim(), req.session.user.id, req.params.id]
    );
    const { weeklyReport: wrSM } = require('../../../services/state-machines');
    await wrSM.transition({
      id: parseInt(req.params.id), from: 'draft', to: 'pending_approval',
      audit: { userId: req.session.user.id, req, details: { reason: 'drag_ack' } },
    }).catch(e => {
      if (e.code !== 'INVALID_STATE_TRANSITION') throw e;
    });

    // Notify Naveen — report now includes drag flag + mitigation
    const principals = await users.principals();
    for (const p of principals) {
      await notif.notify(p.id, 'drag_flag',
         'Weekly report submitted with drag flag and mitigation note. Review in app.');
    }

    res.json({ success: true, message: 'Mitigation note added. Report submitted for approval.' });
  }));

// POST /api/reports/:project_id/approve-all — one-click batch approve all pending reports
router.post('/:project_id/approve-all', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    // M4 Site owns daily_reports — go through its contract.
    const Site = require('../../site/contract');
    const { approved } = await Site.functions.approveAllPendingDailyReports(
      req.params.project_id,
      req.session.user.id
    );
    if (!approved) return res.json({ success: true, approved: 0, message: 'No pending reports.' });
    res.json({ success: true, approved,
      message: `${approved} report${approved>1?'s':''} approved in one go.` });
  }));

// PATCH /api/reports/:id/unflag — PMC un-approves a report to flag it
router.patch('/:id/unflag', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { reason } = req.body;
    // M4 Site owns daily_reports — go through its contract.
    const Site = require('../../site/contract');
    await Site.functions.flagDailyReport({
      reportId: req.params.id,
      flaggedBy: req.session.user.id,
      reason,
    });
    res.json({ success: true, message: 'Report flagged for review.' });
  }));

// ── WEEKLY REPORT AUTO-POPULATION FROM PREVIOUS MOM
// GET /api/reports/:project_id/carry-forward
router.get('/:project_id/carry-forward', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const pid = req.params.project_id;

    // Get last week's approved report (weekly_reports is Reporting-owned)
    const [[lastReport]] = await db.query(
      `SELECT * FROM weekly_reports
       WHERE project_id = ? AND status IN ('approved','sent')
       ORDER BY week_ending DESC LIMIT 1`,
      [pid]
    );

    const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const weekStart = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Cross-module aggregates via contracts
    const Workflow = require('../../workflow/contract');
    const DS       = require('../../design-services/contract');
    const Auth     = require('../../auth/contract');

    const [openItems, newObsRaw, progress] = await Promise.all([
      Workflow.functions.getLatestOpenMomItems(pid, 500),
      Workflow.functions.getSiteVisitObservationsBetween(pid, weekStart, today),
      DS.functions.getScheduleProgressByTradeSince(pid, weekStart),
    ]);

    // Hydrate visitor names for observations (bulk; avoids N+1)
    const visitorIds = newObsRaw.map(o => o.visitor_id).filter(Boolean);
    const visitors = await Auth.functions.getUsers(visitorIds);
    const newObs = newObsRaw.map(o => ({
      ...o,
      visitor_name: visitors.get(o.visitor_id)?.full_name || null,
    }));

    // Week number
    const now       = new Date();
    const startYear = new Date(now.getFullYear(), 0, 1);
    const weekNum   = Math.ceil((((now - startYear) / 86400000) + startYear.getDay() + 1) / 7);

    res.json({
      last_report:    lastReport || null,
      carried_items:  openItems.map(i => ({ ...i, carried_from_week: lastReport?.week_number || null })),
      new_observations: newObs,
      schedule_progress: progress,
      this_week:      weekNum,
      week_start:     weekStart,
      week_end:       today,
    });

  }));

// POST /api/reports/:project_id/mom-items — save MOM items (open/closed with resolution)
router.post('/:project_id/mom-items', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { items } = req.body;  // array of { id?, description, responsible, remarks, status, resolution_note, trade }
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    const pid = req.params.project_id;
    const saved = [];

    // Workflow owns mom_items — go through its contract.
    const Workflow = require('../../workflow/contract');

    for (const item of items) {
      if (item.status === 'closed' && !item.resolution_note?.trim()) {
        return res.status(400).json({
          error: `Item "${item.description.substring(0,40)}…" cannot be closed without a resolution note.`
        });
      }

      const r = await Workflow.functions.upsertMomItem({
        id:              item.id || null,
        projectId:       pid,
        description:     item.description,
        responsible:     item.responsible,
        remarks:         item.remarks,
        trade:           item.trade,
        status:          item.status,
        resolutionNote:  item.resolution_note,
        actorId:         req.session.user.id,
      });
      saved.push(r.id);
    }

    res.json({ success: true, saved_count: saved.length });

  }));

// GET /api/reports/:project_id/mom-items — get all open items for a project
router.get('/:project_id/mom-items', requireAuth, requireRole(...REPORT_READER_ROLES), asyncHandler(async (req, res) => {
    const { status } = req.query;
    const Workflow = require('../../workflow/contract');
    const Auth     = require('../../auth/contract');

    const items = await Workflow.functions.listMomItems(req.params.project_id, { status });
    // Hydrate created_by_name in bulk
    const userIds = items.map(i => i.created_by).filter(Boolean);
    const users = await Auth.functions.getUsers(userIds);
    items.forEach(i => {
      i.created_by_name = users.get(i.created_by)?.full_name || null;
    });
    res.json({ items });
  }));

module.exports = router;
