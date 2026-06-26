// routes/schedule.js
const express  = require('express');
const db       = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const notif = require('../../../services/notifications');
const { requireAuth, requirePMC, requireProjectScope } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const { readFile: readExcel, writeFile: writeExcel } = require('../../../middleware/excel');
const { validators } = require('../../../middleware/validate');
const asyncHandler = require('../../../middleware/asyncHandler');
const sequence = require('../../../services/sequence');
const audit = require('../../../services/audit');
const ol = require('../../../middleware/optimistic-lock');
const router   = express.Router();

// GET /api/schedule/:project_id — current schedule with today's tasks
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { project_id } = req.params;
    const { date } = req.query;  // YYYY-MM-DD, defaults to today IST

    const today = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Get current schedule version
    const [[version]] = await db.query(
      'SELECT * FROM schedule_versions WHERE project_id = ? AND is_current = 1',
      [project_id]
    );

    if (!version) {
      // No schedule yet — still return counts so dashboard stats are accurate
      const [[issuesRow]] = await db.query(
        `SELECT COUNT(*) c FROM issues WHERE project_id=? AND status IN ('open','in_progress')`,
        [project_id]
      );
      const [[grnRow]] = await db.query(
        `SELECT COUNT(*) c FROM grns WHERE project_id=? AND status='pending'`,
        [project_id]
      );
      return res.json({
        version: null,
        tasks: [],
        open_issues: issuesRow?.c || 0,
        pending_grns: grnRow?.c || 0,
        active_tasks_count: 0
      });
    }

    // Get tasks for today
    const [tasks] = await db.query(
      `SELECT st.*,
         tu.pct_complete, tu.notes AS update_notes, tu.is_flagged, tu.flag_note, tu.id AS update_id,
         tv.status AS validation_status, tv.rejection_note AS validation_rejection
       FROM schedule_tasks st
       LEFT JOIN task_updates tu ON tu.task_id = st.id AND tu.report_date = ? AND tu.updated_by = ?
       LEFT JOIN task_validations tv ON tv.task_update_id = tu.id
       WHERE st.schedule_version_id = ? AND st.start_date <= ? AND st.end_date >= ?
       ORDER BY st.trade, st.display_order`,
      [today, req.session.user.id, version.id, today, today]
    );

    // Get open issues count
    const [[issuesRow]] = await db.query(
      `SELECT COUNT(*) c FROM issues WHERE project_id=? AND status IN ('open','in_progress')`,
      [project_id]
    );

    // Get pending GRNs count
    const [[grnRow]] = await db.query(
      `SELECT COUNT(*) c FROM grns WHERE project_id=? AND status='pending'`,
      [project_id]
    );

    // Get active tasks count (incomplete and start_date <= today)
    const [[activeTasksRow]] = await db.query(
      `SELECT COUNT(*) AS c
       FROM schedule_tasks st
       LEFT JOIN (
         SELECT tu1.task_id, tu1.pct_complete
         FROM task_updates tu1
         INNER JOIN (
           SELECT task_id, MAX(report_date) AS max_date
           FROM task_updates
           GROUP BY task_id
         ) tu2 ON tu1.task_id = tu2.task_id AND tu1.report_date = tu2.max_date
       ) tu ON tu.task_id = st.id
       WHERE st.schedule_version_id = ? AND st.start_date <= ? AND COALESCE(tu.pct_complete, 0) < 100`,
      [version.id, today]
    );

    res.json({
      version,
      tasks,
      date: today,
      open_issues: issuesRow?.c || 0,
      pending_grns: grnRow?.c || 0,
      active_tasks_count: activeTasksRow?.c || 0
    });

  }));

// GET /api/schedule/:project_id/tasks/active — tasks active on a given date (default: today IST)
// Used by the photo viewer to populate the task-tag selector.
router.get('/:project_id/tasks/active', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const pid  = req.params.project_id;
  const date = req.query.date ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Include tasks active today + tasks starting within the next 14 days
  // so photos can be tagged to upcoming tasks even before they officially begin.
  const lookahead = new Date(date);
  lookahead.setDate(lookahead.getDate() + 14);
  const lookaheadStr = lookahead.toLocaleDateString('en-CA');

  const [tasks] = await db.query(
    `SELECT st.id, st.task_name, st.trade, st.start_date, st.end_date
       FROM schedule_tasks st
       JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
      WHERE st.project_id = ?
        AND st.end_date >= ?
        AND st.start_date <= ?
        AND (st.is_section IS NULL OR st.is_section = 0)
      ORDER BY st.start_date ASC, st.trade, st.task_name
      LIMIT 100`,
    [pid, date, lookaheadStr]
  );
  res.json({ tasks, date });
}));

// GET /api/schedule/flags/all — all open flags across accessible projects (for Flags tab)
// Must be declared BEFORE /:project_id/flags to avoid route param collision.
router.get('/flags/all', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const { PROJECT_SCOPED_ROLES } = require('../../../middleware/auth');
  const isProjectScoped = PROJECT_SCOPED_ROLES.includes(me.role);

  let projectFilter = '';
  let params = [];

  if (isProjectScoped) {
    const [pRows] = await db.query(
      `SELECT pa.project_id FROM project_assignments pa
       JOIN projects p ON p.id = pa.project_id AND p.status = 'active'
       WHERE pa.user_id = ? AND pa.is_active = 1`,
      [me.id]
    );
    const pids = pRows.map(r => r.project_id);
    if (!pids.length) return res.json({ flags: [] });
    projectFilter = ' AND tu.project_id IN (?)';
    params = [pids];
  }

  const [flags] = await db.query(
    `SELECT st.id, st.task_name, st.trade, st.start_date, st.end_date,
            tu.pct_complete, tu.flag_note, tu.report_date, tu.id AS update_id,
            tu.project_id, p.name AS project_name,
            u.full_name AS flagged_by_name
     FROM task_updates tu
     JOIN schedule_tasks st ON tu.task_id = st.id
     JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
     JOIN projects p ON p.id = tu.project_id
     LEFT JOIN users u ON tu.updated_by = u.id
     WHERE tu.is_flagged = 1 AND tu.flag_resolved = 0${projectFilter}
     ORDER BY tu.project_id, tu.report_date DESC`,
    params
  );
  res.json({ flags });
}));

// GET /api/schedule/:project_id/flags — all currently flagged tasks (any date)
router.get('/:project_id/flags', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const pid = req.params.project_id;
  const [flags] = await db.query(
    `SELECT st.id, st.task_name, st.trade, st.start_date, st.end_date,
            tu.pct_complete, tu.flag_note, tu.report_date, tu.id AS update_id,
            u.full_name AS flagged_by_name
     FROM task_updates tu
     JOIN schedule_tasks st ON tu.task_id = st.id
     JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
     LEFT JOIN users u ON tu.updated_by = u.id
     WHERE tu.project_id = ? AND tu.is_flagged = 1 AND tu.flag_resolved = 0
     ORDER BY tu.report_date DESC`,
    [pid]
  );
  res.json({ flags });
}));

// POST /api/schedule/:project_id/flags/:update_id/resolve — principal resolves a flag
router.post('/:project_id/flags/:update_id/resolve', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const { resolution_note } = req.body || {};
  await db.query(
    'UPDATE task_updates SET flag_resolved = 1, flag_resolved_by = ?, flag_resolved_at = NOW(), flag_resolution_note = ? WHERE id = ? AND project_id = ?',
    [req.session.user.id, resolution_note || null, req.params.update_id, req.params.project_id]
  );
  res.json({ success: true });
}));

// GET /api/schedule/:project_id/lookahead — next N days (default 7).
// Returns the upcoming tasks plus an AI-generated site-readiness plan
// (material / manpower / access / risks). The AI sees both what's done and
// what's coming so the plan is grounded in real progress, not just the
// raw schedule. If AI is unavailable, plan=null and the frontend renders
// a deterministic fallback summary built from the same task list.
router.get('/:project_id/lookahead', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { project_id } = req.params;
    const days = Math.max(1, Math.min(30, parseInt(req.query.days, 10) || 7));
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const window  = new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const [[version]] = await db.query(
      'SELECT * FROM schedule_versions WHERE project_id = ? AND is_current = 1',
      [project_id]
    );

    if (!version) return res.json({ tasks: [], plan: null, days });

    // Upcoming tasks in the window
    const [tasks] = await db.query(
      `SELECT * FROM schedule_tasks
       WHERE schedule_version_id = ? AND end_date >= ? AND start_date <= ?
       ORDER BY start_date, trade`,
      [version.id, today, window]
    );

    // Recently-completed tasks (for AI context — what does the team already have done).
    // pct_complete lives on task_updates (latest update per task), not on schedule_tasks.
    // A task counts as "completed" if its most-recent update reached 100%.
    const [completed] = await db.query(
      `SELECT st.task_name, st.trade, st.end_date
       FROM schedule_tasks st
       INNER JOIN (
         SELECT task_id, MAX(report_date) AS latest_date
         FROM task_updates
         GROUP BY task_id
       ) latest ON latest.task_id = st.id
       INNER JOIN task_updates tu ON tu.task_id = latest.task_id AND tu.report_date = latest.latest_date
       WHERE st.schedule_version_id = ?
         AND tu.pct_complete = 100
         AND st.end_date < ?
       ORDER BY st.end_date DESC
       LIMIT 30`,
      [version.id, today]
    );

    // Project name for the AI prompt
    const [[proj]] = await db.query('SELECT name FROM projects WHERE id = ?', [project_id]);
    const projectName = proj?.name || 'this project';

    let plan = null;
    if (tasks.length) {
      try {
        const ai = require('../../../services/ai');
        plan = await ai.lookaheadPlan(projectName, completed, tasks, days);
      } catch (err) {
        console.error('[schedule.lookahead] AI plan failed:', err.message);
        plan = null;
      }
    }

    res.json({ version, tasks, completed_count: completed.length, plan, days });

  }));

// GET /api/schedule/:project_id/versions — version history
router.get('/:project_id/versions', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const [versions] = await db.query(
      `SELECT * FROM schedule_versions
       WHERE project_id = ? ORDER BY version_number DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      versions.flatMap(v => [v.uploaded_by, v.approved_by].filter(Boolean))
    );
    versions.forEach(v => {
      v.uploaded_by_name = users.get(v.uploaded_by)?.full_name || null;
      v.approved_by_name = users.get(v.approved_by)?.full_name || null;
    });
    res.json({ versions });
  }));

// POST /api/schedule/:project_id/update — site manager records % of today's planned work completed
router.post('/:project_id/update', requireAuth, requireProjectScope(), validators.taskUpdate, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { task_id, pct_complete, notes, is_flagged, flag_note, regression_reason } = req.body;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const pct = parseInt(pct_complete) || 0;

    // ── REGRESSION CHECK
    const [[lastUpdate]] = await db.query(
      `SELECT pct_complete, report_date FROM task_updates
       WHERE task_id=? AND project_id=? AND report_date < ?
       ORDER BY report_date DESC, id DESC LIMIT 1`,
      [task_id, req.params.project_id, today]
    );
    let regressionFlag = is_flagged ? 1 : 0;
    let regressionNote = flag_note;
    if (lastUpdate && pct < parseInt(lastUpdate.pct_complete)) {
      if (!regression_reason || regression_reason.trim().length < 5) {
        return res.status(400).json({
          error: `Progress was ${lastUpdate.pct_complete}% on ${lastUpdate.report_date}. ` +
                 `You are reporting ${pct}% today. If this is correct (rework, demolition, error correction), ` +
                 `provide a reason in the 'regression_reason' field.`,
          code: 'PROGRESS_REGRESSION',
          previous_pct: lastUpdate.pct_complete,
          previous_date: lastUpdate.report_date,
          new_pct: pct,
        });
      }
      regressionFlag = 1;
      regressionNote = `REGRESSION: ${lastUpdate.pct_complete}% → ${pct}%. Reason: ${regression_reason}`;
    }

    await db.query(
      `INSERT INTO task_updates (task_id, project_id, report_date, pct_complete, notes, is_flagged, flag_note, updated_by)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE pct_complete=VALUES(pct_complete), notes=VALUES(notes),
       is_flagged=VALUES(is_flagged), flag_note=VALUES(flag_note)`,
      [task_id, req.params.project_id, today, pct, notes || null, regressionFlag, regressionNote || null, me.id]
    );

    audit.log({ userId: me.id, action: 'task_update.create',
      entityType: 'task_updates', entityId: null,
      details: { project_id: parseInt(req.params.project_id), task_id: parseInt(task_id), pct_complete: pct, regression: !!regressionFlag, report_date: today }, req });

    // SSE real-time notification
    try { require('../../system/routes/sse').notifyProject(req.params.project_id, 'task_update', { project_id: req.params.project_id, task_id }); } catch(_e) {}

    // Notify PMC Head when a task is explicitly flagged or regression-flagged.
    if (regressionFlag) {
      const flagMsg = regressionNote || flag_note || 'No note provided';
      const Auth = require('../../auth/contract');
      const notif = require('../../../services/notifications');
      Auth.functions.getUsersByRole('pmc_head', req.params.project_id).then(async heads => {
        for (const h of heads) {
          await notif.notify(h.id, 'task_flag',
            `Task flagged on project — ${flagMsg.substring(0, 100)}. Reported by ${me.full_name}.`
          );
        }
      }).catch(e => console.warn('[schedule] PMC flag notify swallowed:', e.message));
    }

    res.json({ success: true });

  }));

// POST /api/schedule/:project_id/validate — PMC validates task completion
router.post('/:project_id/validate', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { task_update_id, status, rejection_note } = req.body;
    if (!['validated', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db.query(
      `INSERT INTO task_validations (task_update_id, status, validated_by, rejection_note)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), validated_by=VALUES(validated_by), rejection_note=VALUES(rejection_note)`,
      [task_update_id, status, req.session.user.id, rejection_note || null]
    );
    audit.log({ userId: req.session.user.id, action: 'task_validation.set',
      entityType: 'task_validations', entityId: null,
      details: { project_id: parseInt(req.params.project_id), task_update_id: parseInt(task_update_id), status, rejection_note: rejection_note || null }, req });
    // Notify site manager if task rejected
    if (status === 'rejected') {
      try {
        const [[tu]] = await db.query(
          `SELECT tu.updated_by, st.task_name FROM task_updates tu
           JOIN schedule_tasks st ON tu.task_id = st.id WHERE tu.id = ?`,
          [task_update_id]
        );
        if (tu) {
          const { notifyTaskRejected } = require('../../../services/notifications');
          notifyTaskRejected(tu.updated_by, tu.task_name, rejection_note||'No reason given').catch(e => console.warn('[' + require('path').basename(__filename) + '] swallowed:', e.message));
        }
      } catch(_e) { /* notification failure — non-blocking */ }
    }
    res.json({ success: true });

  }));

// GET /api/schedule/:project_id/template — download blank schedule Excel template
router.get('/:project_id/template', requireAuth, requireProjectScope(),
  asyncHandler(async (req, res) => {
    const os   = require('os');
    const path = require('path');
    const tmp  = path.join(os.tmpdir(), `schedule_template_${Date.now()}.xlsx`);

    await writeExcel([
      ['Trade', 'Task', 'Start Date', 'End Date', 'Milestone Type', 'Milestone Label'],
      ['CIVIL', 'Foundation excavation', '2025-07-01', '2025-07-15', '', ''],
      ['MEP',   'Electrical rough-in',   '2025-07-10', '2025-07-20', 'schedule', 'Electrical Milestone'],
    ], tmp, 'Schedule');

    res.download(tmp, 'schedule_template.xlsx', () => {
      require('fs').unlink(tmp, () => {});
    });
  })
);

// POST /api/schedule/:project_id/upload — PMC uploads new schedule Excel
router.post('/:project_id/upload', requireAuth, requireProjectScope(), requirePMC,
  upload.single('schedule'), asyncHandler(async (req, res) => {
    const { project_id } = req.params;
    const { reason } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Parse Excel
    const rows = await readExcel(file.path);

    // Normalize a cell value to 'YYYY-MM-DD' string.
    // ExcelJS returns date-typed cells as JS Date objects; text cells come as strings.
    const toISO = (v) => {
      if (!v) return '';
      if (v instanceof Date) {
        // Use UTC parts to avoid timezone shifts (Excel dates have no timezone)
        const y = v.getUTCFullYear();
        const m = String(v.getUTCMonth() + 1).padStart(2, '0');
        const d = String(v.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      const s = String(v).trim();
      // Accept DD/MM/YYYY or DD-MM-YYYY (common Indian format)
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
      // Already YYYY-MM-DD or similar ISO
      return s;
    };

    // Get R0 end date
    const Onboarding = require('../../onboarding/contract');
    const project = await Onboarding.functions.getProject(project_id);

    // Calculate end date from tasks in Excel
    let maxEndDate = null;
    for (const row of rows) {
      const endDate = toISO(row['End Date'] || row['end_date'] || row['EndDate']);
      if (endDate && (!maxEndDate || endDate > maxEndDate)) maxEndDate = endDate;
    }

    // Calculate drift
    const r0End   = new Date(project.r0_end_date);
    const newEnd  = new Date(maxEndDate);
    const drift   = Math.round((newEnd - r0End) / 86400000);

    // First schedule for a project auto-approves (no prior baseline)
    // Subsequent uploads with drift need Principal/Design Principal approval
    const [[priorCount]] = await db.query(
      'SELECT COUNT(*) AS c FROM schedule_versions WHERE project_id = ?',
      [project_id]
    );
    const isFirstUpload = priorCount.c === 0;
    const needsApproval = !isFirstUpload && drift !== 0;

    // Create version record atomically — regen on ER_DUP_ENTRY (uq_schedule_version added in v3.1)
    const status = needsApproval ? 'pending_approval' : 'approved';
    let nextVer, versionId;

    // Fail fast if the Excel had no parseable tasks (wrong column names / empty sheet)
    const validTaskRows = rows.filter(r => {
      const trade = String(r['Trade']||r['trade']||'').trim();
      const task  = String(r['Task']||r['task_name']||r['Task Name']||'').trim();
      const sd    = toISO(r['Start Date']||r['start_date']);
      const ed    = toISO(r['End Date']||r['end_date']);
      return trade && task && sd && ed;
    });
    if (validTaskRows.length === 0) {
      return res.status(400).json({ error: 'No valid tasks found in the uploaded file. Expected columns: Trade, Task, Start Date, End Date' });
    }

    // SC3: previously the version INSERT (in insertWithRetry), the tasks INSERT
    // loop, and the demote-old-versions UPDATE were three separate auto-commit
    // writes. A failure mid-loop left a current version with partial tasks,
    // visible to site managers. Now: one tx around all three. insertWithRetry
    // is still needed for the version_number race; it just nests inside the tx.
    await db.tx(async (conn) => {
      // Version INSERT with version_number race retry
      await sequence.insertWithRetry(async () => {
        // Inline the version_number SELECT so it sees the tx's snapshot
        const [[last]] = await conn.query(
          'SELECT version_number AS val FROM schedule_versions WHERE project_id = ? ORDER BY id DESC LIMIT 1',
          [project_id]
        );
        nextVer = (parseInt(last?.val || 0, 10) || 0) + 1;
        const [r] = await conn.query(
          `INSERT INTO schedule_versions (project_id, version_number, label, end_date, drift_days, status, reason, uploaded_by, is_current)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [project_id, nextVer, `v${nextVer}`, maxEndDate, drift, status, reason || null, req.session.user.id, needsApproval ? 0 : 1]
        );
        versionId = r.insertId;
      });

      // Insert tasks within the same tx so a mid-loop failure rolls back the version too
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const trade    = String(row['Trade'] || row['trade'] || '').trim();
        const taskName = String(row['Task'] || row['task_name'] || row['Task Name'] || '').trim();
        const startDate = toISO(row['Start Date'] || row['start_date']);
        const endDate   = toISO(row['End Date']   || row['end_date']);
        if (!trade || !taskName || !startDate || !endDate) continue;

        const msTypeRaw = String(row['Milestone Type']||row['milestone_type']||row['Milestone']||'').toLowerCase().trim();
        const msType = ['schedule','payment','both'].includes(msTypeRaw) ? msTypeRaw : (msTypeRaw==='y'||msTypeRaw==='yes'?'schedule':'none');
        const milestoneLabel = row['Milestone Label']||row['milestone_label']||null;
        await conn.query(
          `INSERT INTO schedule_tasks (project_id, schedule_version_id, trade, task_name, start_date, end_date, milestone_type, milestone_label, display_order)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [project_id, versionId, trade, taskName, startDate, endDate, msType, milestoneLabel, i]
        );
      }

      // Auto-approve path: demote old versions inside the tx so the swap is atomic.
      if (!needsApproval) {
        await conn.query(
          'UPDATE schedule_versions SET is_current = 0 WHERE project_id = ? AND id != ?',
          [project_id, versionId]
        );
      }
    });

    // Side-effects after tx (non-atomic — checklist flag, notifications)
    if (!needsApproval) {
      const Onboarding = require('../../onboarding/contract');
      await Onboarding.functions.setChecklistFlag(project_id, 'checklist_schedule');
      // (Earlier code wrote an "audit clutter" row to wa_pending_actions
      // with status='approved' for dashboard display. Removed: the dashboard
      // reads only status='pending' rows, so it was pure write-noise.
      // D1 cleanup, May 2026.)
    } else {
      // Create approval request for Principal/Design Principal
      const principals = await users.principals();
      for (const p of principals) {
        await notif.notify(p.id, 'schedule_change', `Schedule v${nextVer} uploaded — ${drift} days drift from R0`);
      }
    }

    audit.log({ userId: req.session.user.id, action: 'schedule.upload',
      entityType: 'schedule_versions', entityId: versionId,
      details: { project_id: parseInt(project_id), version_number: nextVer, drift_days: drift, status, needs_approval: needsApproval, reason: reason || null }, req });

    res.json({
      success: true,
      version_id: versionId,
      drift_days: drift,
      needs_approval: needsApproval,
      message: needsApproval
        ? `Schedule uploaded. Drift is ${drift} days — PMC Head must acknowledge and prepare mitigation note before Principal reviews.`
        : `Schedule uploaded and live. Drift ${drift} days — within threshold.`
    });

  }));

// PATCH /api/schedule/:project_id/drift-acknowledge — PMC Head acknowledges drift
// and prepares mitigation before Principal reviews
//
// Optimistic-lock guard (B28 fix): two PMC heads (or a head + their deputy)
// on the same project could otherwise concurrently acknowledge the same
// version's drift. The second save would silently overwrite the first's
// mitigation note and `drift_acknowledged_by` attribution. Now: client must
// echo row_version; second save 409s.
router.patch('/:project_id/drift-acknowledge', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { version_id, mitigation_note, row_version } = req.body;
    if (!mitigation_note) return res.status(400).json({ error: 'Mitigation note required to acknowledge drift' });
    if (row_version === undefined || row_version === null) {
      throw new ol.StaleVersionError('schedule_versions', parseInt(version_id), null, 'missing');
    }
    const [upd] = await db.query(
      `UPDATE schedule_versions
          SET drift_acknowledged = 1,
              drift_acknowledged_by = ?,
              drift_acknowledged_at = NOW(),
              drift_mitigation = ?,
              row_version = row_version + 1
        WHERE id = ? AND project_id = ? AND row_version = ?`,
      [req.session.user.id, mitigation_note, version_id, req.params.project_id, row_version]
    );
    if (upd.affectedRows === 0) {
      const [[fresh]] = await db.query(
        'SELECT row_version FROM schedule_versions WHERE id = ? AND project_id = ?',
        [version_id, req.params.project_id]
      );
      throw new ol.StaleVersionError('schedule_versions', parseInt(version_id), row_version, fresh ? fresh.row_version : 'not_found');
    }
    // Now notify principals for review
    const principals = await users.principals();
    for (const p of principals) {
      await notif.notify(p.id, 'schedule_drift', `Schedule drift acknowledged by PMC Head. Mitigation plan ready — your review needed.`);
    }
    audit.log({ userId: req.session.user.id, action: 'schedule.drift_acknowledge',
      entityType: 'schedule_versions', entityId: parseInt(version_id),
      details: { project_id: parseInt(req.params.project_id), mitigation_note }, req });
    res.json({ success: true, row_version: parseInt(row_version) + 1, message: 'Drift acknowledged — Principal and Design Principal notified for review.' });
  }));

// PATCH /api/schedule/:project_id/tasks/:task_id/progress — site manager updates progress
router.patch('/:project_id/tasks/:task_id/progress', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canUpdate = ['site_manager','senior_site_manager','pmc_head',
                       'principal','design_principal'].includes(me.role);
    if (!canUpdate) return res.status(403).json({ error: 'Not authorised' });

    const { pct_complete, notes, regression_reason } = req.body;

    // ── NUMERIC VALIDATION
    const { validatePercent } = require('../../../services/payment-validation');
    const pctCheck = validatePercent(pct_complete, 'Progress %');
    if (!pctCheck.ok) {
      return res.status(400).json({ error: pctCheck.error, code: 'INVALID_PERCENT' });
    }
    const pct = pctCheck.pct;

    // Calculate expected % from task dates
    const [[task]] = await db.query(
      'SELECT start_date, end_date FROM schedule_tasks WHERE id=? AND project_id=?',
      [req.params.task_id, req.params.project_id]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // ── REGRESSION CHECK — today's % < previous %?
    const [[lastUpdate]] = await db.query(
      `SELECT pct_complete, report_date FROM task_updates
       WHERE task_id=? AND project_id=?
       ORDER BY report_date DESC, id DESC LIMIT 1`,
      [req.params.task_id, req.params.project_id]
    );
    let regressionFlag = false;
    let regressionNote = null;
    if (lastUpdate && pct < parseInt(lastUpdate.pct_complete)) {
      if (!regression_reason || regression_reason.trim().length < 5) {
        return res.status(400).json({
          error: `Progress was ${lastUpdate.pct_complete}% on ${lastUpdate.report_date}. ` +
                 `You are reporting ${pct}% today. If this is correct (rework, demolition, error correction), ` +
                 `provide a reason in the 'regression_reason' field.`,
          code: 'PROGRESS_REGRESSION',
          previous_pct: lastUpdate.pct_complete,
          previous_date: lastUpdate.report_date,
          new_pct: pct,
        });
      }
      regressionFlag = true;
      regressionNote = `REGRESSION: ${lastUpdate.pct_complete}% → ${pct}%. Reason: ${regression_reason}`;
    }

    const now      = new Date();
    const start    = new Date(task.start_date);
    const end      = new Date(task.end_date);
    const duration = (end - start) / 86400000;
    const elapsed  = Math.max(0, Math.min(duration, (now - start) / 86400000));
    const expected = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
    const diff     = Math.abs(pct - expected);
    const autoValidate = !regressionFlag && diff <= 15;

    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    await db.query(
      `INSERT INTO task_updates
       (task_id, project_id, report_date, pct_complete, notes, is_flagged, flag_note, updated_by)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE pct_complete=VALUES(pct_complete), notes=VALUES(notes),
         is_flagged=VALUES(is_flagged), flag_note=VALUES(flag_note), updated_by=VALUES(updated_by)`,
      [req.params.task_id, req.params.project_id, today, pct, notes||null,
       autoValidate ? 0 : 1,
       autoValidate ? null : (regressionNote || `Progress ${pct}% is ${diff.toFixed(1)}% from expected ${expected.toFixed(1)}%`),
       me.id]
    );

    if (!autoValidate) {
      // Flag to PMC Head
      const Auth = require('../../auth/contract');
      const pmcHeads = await Auth.functions.getUsersByRole('pmc_head', req.params.project_id);
      for (const p of pmcHeads) {
        await notif.notify(p.id, 'task_outlier',
           `Task progress outlier: ${pct}% reported vs ${expected.toFixed(0)}% expected (${diff.toFixed(0)}% gap). Review needed.`);
      }
    }

    audit.log({ userId: me.id, action: 'task_progress.update',
      entityType: 'task_updates', entityId: null,
      details: { project_id: parseInt(req.params.project_id), task_id: parseInt(req.params.task_id), pct_complete: pct, expected_pct: parseFloat(expected.toFixed(1)), auto_validated: autoValidate, regression: regressionFlag, report_date: today }, req });

    res.json({ success: true, auto_validated: autoValidate,
      expected_pct: expected.toFixed(1), actual_pct: pct,
      message: autoValidate
        ? `Progress updated (${pct}%) — auto-validated.`
        : `Progress updated (${pct}%) — flagged to PMC: ${diff.toFixed(0)}% from expected.`
    });
  }));

// GET /api/schedule/:project_id/lookahead/workspace — planning workspace data
router.get('/:project_id/lookahead/workspace', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { project_id } = req.params;
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Calculate this week's boundaries (Monday to Sunday)
    const today = new Date(todayStr + 'T00:00:00');
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(today.getTime() + diffToMon * 86400000);
    const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
    const startOfWeekStr = startOfWeek.toLocaleDateString('en-CA');
    const endOfWeekStr = endOfWeek.toLocaleDateString('en-CA');

    const [[version]] = await db.query(
      'SELECT * FROM schedule_versions WHERE project_id = ? AND is_current = 1',
      [project_id]
    );

    if (!version) {
      return res.json({ version: null, tasks: [], assignees: [], metrics: { upcoming: 0, dueThisWeek: 0, overdue: 0, completedThisWeek: 0 } });
    }

    // Get all tasks with latest completion progress
    const [tasks] = await db.query(
      `SELECT st.id, st.task_name, st.trade,
              DATE_FORMAT(st.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(st.end_date, '%Y-%m-%d') AS end_date,
              st.display_order, st.planning_note,
              COALESCE(tu.pct_complete, 0) AS pct_complete
       FROM schedule_tasks st
       LEFT JOIN (
         SELECT tu1.task_id, tu1.pct_complete
         FROM task_updates tu1
         INNER JOIN (
           SELECT task_id, MAX(report_date) AS max_date
           FROM task_updates
           GROUP BY task_id
         ) tu2 ON tu1.task_id = tu2.task_id AND tu1.report_date = tu2.max_date
       ) tu ON tu.task_id = st.id
       WHERE st.schedule_version_id = ?
       ORDER BY st.start_date ASC, st.display_order ASC`,
      [version.id]
    );

    // Calculate metrics
    const upcoming = tasks.filter(t => t.start_date > todayStr).length;
    const dueThisWeek = tasks.filter(t => t.end_date >= startOfWeekStr && t.end_date <= endOfWeekStr && t.pct_complete < 100).length;
    const overdue = tasks.filter(t => t.end_date < todayStr && t.pct_complete < 100).length;

    const [[completedThisWeekRes]] = await db.query(
      `SELECT COUNT(DISTINCT task_id) AS c FROM task_updates
       WHERE project_id = ? AND pct_complete = 100 AND report_date >= ? AND report_date <= ?`,
      [project_id, startOfWeekStr, endOfWeekStr]
    );
    const completedThisWeek = completedThisWeekRes?.c || 0;

    // Get active project team members for Assignee selector
    const [assignees] = await db.query(
      `SELECT u.id, u.full_name, u.role FROM users u
       INNER JOIN project_assignments pa ON pa.user_id = u.id
       WHERE pa.project_id = ? AND pa.is_active = 1
       ORDER BY u.full_name ASC`,
      [project_id]
    );

    res.json({
      version,
      tasks,
      assignees,
      metrics: { upcoming, dueThisWeek, overdue, completedThisWeek }
    });
}));

// PATCH /api/schedule/:project_id/tasks/:task_id/planning-note — save planning note for a task
router.patch('/:project_id/tasks/:task_id/planning-note', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const { project_id, task_id } = req.params;
  const me = req.session.user;
  const canSchedule = ['site_manager','senior_site_manager','pmc_head','principal','design_principal','coordinator'].includes(me.role);
  if (!canSchedule) return res.status(403).json({ error: 'Not authorised' });

  const note = String(req.body.planning_note || '').slice(0, 1000);

  const [[task]] = await db.query(
    'SELECT id FROM schedule_tasks WHERE id = ? AND project_id = ?',
    [task_id, project_id]
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });

  await db.query(
    'UPDATE schedule_tasks SET planning_note = ? WHERE id = ?',
    [note || null, task_id]
  );
  res.json({ ok: true });
}));

// POST /api/schedule/:project_id/tasks — create planning task
router.post('/:project_id/tasks', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { project_id } = req.params;
    const me = req.session.user;
    const canSchedule = ['site_manager','senior_site_manager','pmc_head','principal','design_principal','coordinator'].includes(me.role);
    if (!canSchedule) return res.status(403).json({ error: 'Not authorised to schedule tasks' });

    const { task_name, description, assignee_id, priority, start_date, end_date, trade } = req.body;
    if (!task_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'Task name, start date, and due date are required' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ error: 'Due date cannot be before start date' });
    }

    let [[version]] = await db.query(
      'SELECT * FROM schedule_versions WHERE project_id = ? AND is_current = 1',
      [project_id]
    );

    if (!version) {
      // Create version 1 baseline automatically if none exists
      const [r] = await db.query(
        `INSERT INTO schedule_versions (project_id, version_number, label, end_date, status, uploaded_by, is_current)
         VALUES (?, 1, 'v1', ?, 'approved', ?, 1)`,
        [project_id, end_date, me.id]
      );
      version = { id: r.insertId };
    }

    // Get next display order
    const [[maxOrder]] = await db.query(
      'SELECT COALESCE(MAX(display_order), 0) AS max_ord FROM schedule_tasks WHERE schedule_version_id = ?',
      [version.id]
    );
    const nextOrder = (maxOrder?.max_ord || 0) + 1;

    const [r] = await db.query(
      `INSERT INTO schedule_tasks (project_id, schedule_version_id, trade, task_name, start_date, end_date, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [project_id, version.id, trade || 'General', task_name, start_date, end_date, nextOrder]
    );

    audit.log({
      userId: me.id,
      action: 'schedule_task.create',
      entityType: 'schedule_tasks',
      entityId: r.insertId,
      details: { project_id: parseInt(project_id), task_name, start_date, end_date },
      req
    });

    res.json({ success: true, task_id: r.insertId });
}));

module.exports = router;

// POST /api/schedule/:project_id/vendor-signoff — send schedule to vendor for commitment poll
// F6, friction-reduction brief.
// PMC sends the upcoming task list for a vendor's engagement.
// Poll: ✅ Accepted — I commit to these dates / ❌ Cannot commit
// Rejection handled offline. Matrix records final acceptance only.
router.post('/:project_id/vendor-signoff', requireAuth, requireProjectScope(),
  asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canSend = ['pmc_head','senior_site_manager','principal','design_principal'].includes(me.role);
    if (!canSend) return res.status(403).json({ error: 'Not authorised' });

    const { vendor_id, task_ids, message } = req.body;
    if (!vendor_id || !task_ids?.length) {
      return res.status(400).json({ error: 'vendor_id and task_ids required' });
    }

    // Fetch the task details
    const placeholders = task_ids.map(() => '?').join(',');
    const [tasks] = await db.query(
      `SELECT task_name, start_date, end_date FROM schedule_tasks
        WHERE id IN (${placeholders}) AND project_id = ?`,
      [...task_ids, req.params.project_id]
    );
    if (!tasks.length) return res.status(404).json({ error: 'Tasks not found' });

    const taskLines = tasks.map(t => {
      const start = new Date(t.start_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const end   = new Date(t.end_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      return `\u2022 ${t.task_name}: ${start} \u2013 ${end}`;
    }).join('\n');

    try {
      const signoffGate = require('../../../services/signoff-gate');
      await signoffGate.triggerSignoff(
        'vendor_schedule_commitment',
        null,
        parseInt(req.params.project_id, 10),
        {
          question: `Schedule commitment request:\n${taskLines}${message ? '\n\nNote: ' + message : ''}`,
          triggeredBy: me.id,
          vendorId: parseInt(vendor_id, 10),
        }
      );
    } catch (e) {
      console.warn('[vendor-signoff] signoff trigger failed:', e.message);
    }

    audit.log({
      userId: me.id,
      action: 'schedule.vendor_signoff_sent',
      entityType: 'projects',
      entityId: parseInt(req.params.project_id, 10),
      details: { project_id: parseInt(req.params.project_id, 10), vendor_id: parseInt(vendor_id, 10), task_count: tasks.length },
      req
    });

    res.json({ success: true, task_count: tasks.length });
  }));
