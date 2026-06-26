// modules/design-services/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// DESIGN-SERVICES MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// The "drawing + schedule + BOQ" core of nu PMC. Serves both design and
// services streams (distinguished by a `stream` column on the tables, not
// by folder structure — see earlier V5 discussion).
//
// - Drawings (upload, version, approve, flag) — dual stream via stream col
// - Drawing register (what drawings are expected + signed off)
// - Schedule (R0 baseline + revisions, tasks, milestones)
// - Materials / BOQ (internal BOQ per stream + material requests)
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  functions: {
    /** Get the current-version BOQ items for a project, optionally by stream. */
    async getCurrentBOQ(projectId, stream = null) {
      const params = [projectId];
      let where = `bv.project_id = ? AND bv.is_current = 1`;
      if (stream) { where += ` AND bv.stream = ?`; params.push(stream); }
      const [rows] = await db.query(
        `SELECT bi.id, bi.trade, bi.item_code, bi.item_name, bi.unit,
                bi.quantity, bi.display_order, bi.is_section, bv.stream
         FROM boq_items bi
         JOIN boq_versions bv ON bi.boq_version_id = bv.id
         WHERE ${where}
         ORDER BY bv.stream, bi.display_order`,
        params
      );
      return rows;
    },

    /** Schedule tasks for a project (current approved version). */
    async getScheduleTasks(projectId) {
      const [rows] = await db.query(
        `SELECT st.id, st.trade, st.task_name, st.start_date, st.end_date,
                st.display_order, st.is_milestone, st.milestone_type, st.milestone_label
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id
         WHERE st.project_id = ? AND sv.is_current = 1
         ORDER BY st.display_order`,
        [projectId]
      );
      return rows;
    },

    /** Drawings for a project (optionally filtered by stream). */
    async getDrawings(projectId, stream = null) {
      const params = [projectId];
      let where = 'project_id = ?';
      if (stream) { where += ' AND stream = ?'; params.push(stream); }
      const [rows] = await db.query(
        `SELECT id, drawing_number, drawing_name, category, stream, drawing_type, created_at
         FROM drawings WHERE ${where}
         ORDER BY drawing_number`,
        params
      );
      return rows;
    },

    /** Register entries for a project (expected drawings + sign-off status). */
    async getDrawingRegister(projectId, stream = null) {
      const params = [projectId];
      let where = 'project_id = ?';
      if (stream) { where += ' AND stream = ?'; params.push(stream); }
      const [rows] = await db.query(
        `SELECT id, drawing_number, drawing_name, category, stream, status,
                expected_revision, signed_off_by, signed_off_at
         FROM drawing_register WHERE ${where}
         ORDER BY drawing_number`,
        params
      );
      return rows;
    },

    /**
     * Aggregated schedule summary for weekly report generation.
     * Returns { totalTasks, completed, inProgress, onHold, avgPctComplete, lastUpdateDate }
     * using the current schedule version only.
     */
    async getCurrentScheduleSummary(projectId) {
      if (!projectId) throw new Error('projectId is required');
      // NOTE: schedule_tasks has no `status` column — the prior helper SELECTed
      // `st.status` which fails at runtime with ERROR 1054. Derived status from
      // each task's latest task_update.pct_complete:
      //   latest pct_complete = 100 → completed
      //   latest pct_complete 1-99  → in_progress
      //   no updates or 0           → not started (neither completed nor in_progress)
      // `on_hold` cannot be derived without a status source; reporting as 0.
      const [[row]] = await db.query(
        `SELECT
           COUNT(*) AS total_tasks,
           SUM(CASE WHEN latest_pct.pct = 100           THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN latest_pct.pct BETWEEN 1 AND 99 THEN 1 ELSE 0 END) AS in_progress,
           0 AS on_hold,
           COALESCE(AVG(latest_pct.pct), 0) AS avg_pct_complete,
           MAX(latest_pct.report_date) AS last_update_date
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
         LEFT JOIN (
           SELECT tu1.task_id, tu1.pct_complete AS pct, tu1.report_date
           FROM task_updates tu1
           WHERE tu1.id = (
             SELECT MAX(tu2.id) FROM task_updates tu2 WHERE tu2.task_id = tu1.task_id
           )
         ) latest_pct ON latest_pct.task_id = st.id
         WHERE sv.project_id = ?`,
        [projectId]
      );
      return row || { total_tasks: 0, completed: 0, in_progress: 0, on_hold: 0, avg_pct_complete: 0, last_update_date: null };
    },

    /**
     * Recent task updates for a project's weekly report.
     * Joins task_updates with schedule_tasks so the returned rows include
     * task names without the caller needing a second lookup.
     */
    async getRecentTaskUpdates(projectId, sinceDate) {
      if (!projectId || !sinceDate) throw new Error('projectId and sinceDate are required');
      const [rows] = await db.query(
        `SELECT tu.id, tu.task_id, tu.report_date, tu.pct_complete, tu.notes,
                st.task_name, st.trade
         FROM task_updates tu
         JOIN schedule_tasks st ON tu.task_id = st.id
         WHERE st.project_id = ? AND tu.report_date >= ?
         ORDER BY tu.report_date DESC`,
        [projectId, sinceDate]
      );
      return rows;
    },

    /** Material requests flagged as overdue. */
    async getOverdueMaterialRequests(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT mr.id, mr.raised_at, mr.needed_by_date, mr.quantity_needed,
                bi.item_name, bi.unit
         FROM material_requests mr
         JOIN boq_items bi ON mr.boq_item_id = bi.id
         WHERE mr.project_id = ? AND mr.is_overdue = 1
         ORDER BY mr.needed_by_date`,
        [projectId]
      );
      return rows;
    },

    /**
     * Average task progress for a trade over a date range.
     * Returns null if no updates in range.
     */
    async getTaskProgressByTradeMonth(projectId, trade, startDate, endDate) {
      if (!projectId || !trade) throw new Error('projectId and trade are required');
      const [[row]] = await db.query(
        `SELECT AVG(tu.pct_complete) AS avg_pct
         FROM task_updates tu
         JOIN schedule_tasks st ON tu.task_id = st.id
         WHERE st.project_id = ? AND st.trade = ?
           AND tu.report_date BETWEEN ? AND ?`,
        [projectId, trade, startDate, endDate]
      );
      return row?.avg_pct != null ? parseFloat(row.avg_pct) : null;
    },

    /**
     * Schedule progress grouped by trade — one row per trade.
     * Returns [{ trade, avg_pct, task_count }, ...] using the current schedule version.
     */
    async getScheduleProgressByTrade(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT st.trade, AVG(tu.pct_complete) AS avg_pct,
                COUNT(DISTINCT st.id) AS task_count
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
         LEFT JOIN task_updates tu ON tu.task_id = st.id
         WHERE st.project_id = ?
         GROUP BY st.trade`,
        [projectId]
      );
      return rows;
    },

    /**
     * Schedule progress grouped by trade, restricted to updates since a date.
     * Used by weekly carry-forward reports. Adds a flag count per trade.
     * @returns {Promise<Array<{trade, avg_pct, task_count, flags}>>}
     */
    async getScheduleProgressByTradeSince(projectId, sinceDate) {
      if (!projectId || !sinceDate) throw new Error('projectId and sinceDate are required');
      const [rows] = await db.query(
        `SELECT st.trade,
                AVG(tu.pct_complete) AS avg_pct,
                COUNT(DISTINCT st.id) AS task_count,
                SUM(tu.is_flagged) AS flags
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id AND sv.is_current = 1
         LEFT JOIN task_updates tu ON tu.task_id = st.id AND tu.report_date >= ?
         WHERE st.project_id = ?
         GROUP BY st.trade
         ORDER BY st.trade`,
        [sinceDate, projectId]
      );
      return rows;
    },

    /**
     * Flagged task updates (tu.is_flagged=1) with task context.
     * Used by weekly report "open flags" section.
     */
    async getFlaggedTaskUpdates(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT tu.flag_note, st.task_name, st.trade
         FROM task_updates tu
         JOIN schedule_tasks st ON tu.task_id = st.id
         WHERE tu.project_id = ? AND tu.is_flagged = 1`,
        [projectId]
      );
      return rows;
    },

    /**
     * All material requests for a project with BOQ context.
     * Used by weekly report materials status summary.
     */
    async getMaterialRequestsWithBOQ(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT bi.item_name, bi.trade, mr.status, mr.needed_by_date, mr.is_overdue
         FROM material_requests mr
         JOIN boq_items bi ON mr.boq_item_id = bi.id
         WHERE mr.project_id = ?
         ORDER BY mr.is_overdue DESC, mr.needed_by_date ASC`,
        [projectId]
      );
      return rows;
    },

    /**
     * Schedule tasks (current version) with their latest pct_complete.
     * Used by weekly-report AI drag analysis.
     * Returns [{ trade, task_name, start_date, end_date, actual_pct }, ...].
     */
    /** Returns the current schedule version row for a project, or null.
     *  Callers typically need id/label/drift_days for display. */
    async getCurrentScheduleVersion(projectId) {
      const [[row]] = await db.query(
        `SELECT id, project_id, version_number, label, drift_days, status, is_current,
                approved_by, approved_at, created_at
         FROM schedule_versions
         WHERE project_id = ? AND is_current = 1`,
        [projectId]
      );
      return row || null;
    },

    /** Cheap boolean: does a current schedule exist? Used for gating questions
     *  like "AI should run on uploaded-schedule context" vs "no schedule yet". */
    async hasCurrentScheduleVersion(projectId) {
      const [[row]] = await db.query(
        `SELECT id FROM schedule_versions WHERE project_id = ? AND is_current = 1 LIMIT 1`,
        [projectId]
      );
      return !!row;
    },

    /** Promote a schedule version to is_current for a project.
     *  - Demotes any existing current version (is_current=0, status='approved').
     *  - Elevates the specified version (is_current=1, status='approved', approved_by, approved_at=NOW).
     *  - Returns the promoted version's row (label, drift_days) for downstream notifications.
     *  Optional `conn` parameter: when supplied (e.g. by a caller's db.tx
     *  callback), the writes use that connection so the entire surrounding
     *  workflow commits or rolls back atomically. Without it, the writes
     *  run on the auto-commit pool — preserves the pre-W1 behavior. */
    async promoteScheduleVersion(versionId, projectId, approvedBy, conn = null) {
      const exec = conn ? conn : db;
      // Demote any currently-current version (flip is_current only, no status
      // change). Pre-v5.22 this UPDATE was over-broad — it wrote
      // status='approved' across every row for the project, including drafts
      // and pending. Limited here to the genuinely-current row.
      await exec.query(
        `UPDATE schedule_versions SET is_current = 0
         WHERE project_id = ? AND is_current = 1`,
        [projectId]
      );
      // Promote the new version. State change goes through state machine.
      const [[newVer]] = await exec.query(
        'SELECT status FROM schedule_versions WHERE id = ?', [versionId]
      );
      if (newVer) {
        const sm = require('../../../services/state-machines').scheduleVersion;
        if (newVer.status !== 'approved') {
          await sm.transition({
            id: versionId, from: newVer.status, to: 'approved',
            extraCols: { is_current: 1, approved_by: approvedBy, approved_at: new Date() },
            conn,
          });
        } else {
          // Already approved — just mark current
          await exec.query(
            `UPDATE schedule_versions SET is_current = 1, approved_by = ?, approved_at = NOW() WHERE id = ?`,
            [approvedBy, versionId]
          );
        }
      }
      const [[row]] = await exec.query(
        `SELECT label, drift_days FROM schedule_versions WHERE id = ?`,
        [versionId]
      );
      return row || null;
    },

    async getTasksWithLatestUpdate(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT st.trade, st.task_name, st.start_date, st.end_date,
                COALESCE((SELECT tu.pct_complete FROM task_updates tu
                  WHERE tu.task_id = st.id
                  ORDER BY tu.report_date DESC LIMIT 1), 0) AS actual_pct
         FROM schedule_tasks st
         JOIN schedule_versions sv ON st.schedule_version_id = sv.id
         WHERE st.project_id = ? AND sv.is_current = 1`,
        [projectId]
      );
      return rows;
    },

    /** Bulk hydrate drawing context (number, name, stream, file_path) for a
     *  set of drawing_version_ids. Used by issues/RFI endpoints where the row
     *  has drawing_version_id but needs to display drawing metadata.
     *  Returns Map<version_id, {version_id, drawing_id, drawing_number, drawing_name, stream, file_path, revision, status}>. */
    async getDrawingContextByVersionIds(versionIds) {
      const clean = [...new Set((versionIds || []).filter(Boolean))];
      if (!clean.length) return new Map();
      const placeholders = clean.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT dv.id AS version_id, dv.drawing_id, dv.file_path, dv.revision, dv.status,
                d.drawing_number, d.drawing_name, d.stream, d.project_id
         FROM drawing_versions dv
         JOIN drawings d ON dv.drawing_id = d.id
         WHERE dv.id IN (${placeholders})`,
        clean
      );
      return new Map(rows.map(r => [r.version_id, r]));
    },

    /** Count drawing versions on a project by status filter, optionally
     *  restricted to a stream. Used by needs-you/acc-summary/weekly-health
     *  report endpoints which want per-status counts like 'pending_l1'.
     *  
     *  `statuses` is an array of status values to match (OR'd together).
     *  `stream` is optional ('design'|'services') — omit for both. */
    async countDrawingVersions(projectId, statuses, stream = null) {
      if (!statuses || !statuses.length) return 0;
      const params = [projectId, ...statuses];
      let q = `SELECT COUNT(*) AS cnt
               FROM drawing_versions dv
               JOIN drawings d ON dv.drawing_id = d.id
               WHERE d.project_id = ? AND dv.status IN (${statuses.map(()=>'?').join(',')})`;
      if (stream) { q += ' AND d.stream = ?'; params.push(stream); }
      const [[row]] = await db.query(q, params);
      return row?.cnt || 0;
    },

    /** Count drawing versions across multiple projects by status. Used by
     *  role-scoped reports like needs-you which aggregate across the user's
     *  assigned projects. Returns total count.
     *  
     *  `projectIds` semantics matches countWithScope:
     *    - null       → firm-wide (no project filter)
     *    - []         → trivially 0 (role is scoped but has no projects)
     *    - [1, 2, ..] → filter to those projects
     */
    async countDrawingVersionsMulti(projectIds, statuses, stream = null) {
      if (!statuses || !statuses.length) return 0;
      if (Array.isArray(projectIds) && projectIds.length === 0) return 0;
      const cleanPids = projectIds ? projectIds.filter(Boolean) : null;
      const params = [];
      // Count only the is_current version per drawing — matches the filter used
      // by GET /api/drawings/:pid which joins on dv.is_current = 1. Using MAX(dv.id)
      // diverged when is_current was not the highest-ID row (e.g. after a reject/re-upload).
      // Join projects to restrict to active/initialising only — mirrors the
      // getActiveProjects() filter used to build APP.user.projects on the frontend.
      // Without this, firm-wide roles (projectIds = null) counted drawings from
      // completed projects that never appear in the portfolio view.
      let q = `SELECT COUNT(*) AS cnt
               FROM drawing_versions dv
               JOIN drawings d ON dv.drawing_id = d.id
               JOIN projects p ON p.id = d.project_id
               WHERE dv.status IN (${statuses.map(()=>'?').join(',')})
                 AND dv.is_current = 1
                 AND p.status IN ('active','initialising')`;
      params.push(...statuses);
      if (cleanPids && cleanPids.length) {
        q += ` AND d.project_id IN (${cleanPids.map(()=>'?').join(',')})`;
        params.push(...cleanPids);
      }
      if (stream) { q += ' AND d.stream = ?'; params.push(stream); }
      const [[row]] = await db.query(q, params);
      return row?.cnt || 0;
    },
  },
  routes: {
    drawings:  require('./routes/drawings'),
    register:  require('./routes/register'),
    schedule:  require('./routes/schedule'),
    materials: require('./routes/materials'),
    scheduleQuick: require('./routes/schedule-quick'),
    rfis:      require('./routes/rfis'),
  },

  tables: [
    'drawings',
    'drawing_versions',
    'drawing_register',
    'drawing_ai_checks',
    'schedule_versions',
    'schedule_tasks',
    'task_updates',
    'task_validations',
    'boq_versions',
    'boq_items',
    'material_requests',
    'material_approvals',
  ],
};
