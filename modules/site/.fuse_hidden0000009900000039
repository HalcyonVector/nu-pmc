// modules/site/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M4 SITE MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// Owns the "site operations" phase: daily reports, GRNs (goods received
// notes), issues (RFI/design/safety/quality flags), photos, photo tagging.
//
// Read by other modules via this contract only. Most notable consumer:
// Finance reads approved GRNs to raise payments.
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  // ── FUNCTIONS (async helpers other modules may call) ────────────────────
  functions: {
    /** Get the daily report for a specific project + date, or null. */
    async getDailyReport(projectId, reportDate) {
      const [rows] = await db.query(
        `SELECT id, project_id, report_date, site_manager_id, overall_notes,
                status, approved_by, approved_at, submitted_at
         FROM daily_reports
         WHERE project_id = ? AND report_date = ?`,
        [projectId, reportDate]
      );
      return rows[0] || null;
    },

    /** Return all open issues (not resolved) for a project. */
    async getOpenIssues(projectId) {
      const [rows] = await db.query(
        `SELECT id, issue_number, issue_type, title, description, raised_by,
                drawing_id, status, raised_at
         FROM issues
         WHERE project_id = ? AND status = 'open'
         ORDER BY raised_at DESC`,
        [projectId]
      );
      return rows;
    },

    /** GRNs currently in the review pipeline (not yet approved). */
    async getOpenGRNs(projectId) {
      const [rows] = await db.query(
        `SELECT g.id, g.grn_number, g.engagement_id, g.delivery_date,
                g.description, g.quantity_received, g.unit, g.raised_by,
                g.status, g.raised_at,
                v.vendor_name
         FROM grns g
         LEFT JOIN vendor_engagements e ON g.engagement_id = e.id
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE g.project_id = ?
           AND (g.status IS NULL OR g.status != 'approved')
         ORDER BY g.delivery_date DESC`,
        [projectId]
      );
      return rows;
    },

    /**
     * Approved GRNs — the handoff point to Finance module.
     * Finance reads these to decide which deliveries are eligible for payment.
     */
    async getApprovedGRNs(projectId) {
      const [rows] = await db.query(
        `SELECT g.id, g.grn_number, g.engagement_id, g.delivery_date,
                g.description, g.quantity_received, g.unit, g.raised_by,
                v.vendor_name
         FROM grns g
         LEFT JOIN vendor_engagements e ON g.engagement_id = e.id
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE g.project_id = ? AND g.status = 'approved'
         ORDER BY g.delivery_date DESC`,
        [projectId]
      );
      return rows;
    },

    /** Return site team for a project (site_manager + senior_site_manager). */
    async getSiteTeam(projectId) {
      const [rows] = await db.query(
        `SELECT pa.user_id, u.username, u.full_name, u.role
         FROM project_assignments pa
         JOIN users u ON pa.user_id = u.id
         WHERE pa.project_id = ? AND pa.is_active = 1
           AND u.role IN ('site_manager', 'senior_site_manager')
         ORDER BY u.full_name`,
        [projectId]
      );
      return rows;
    },

    /** Daily reports between two dates for a project — used by weekly health. */
    async getDailyReportsInRange(projectId, startDate, endDate) {
      const [rows] = await db.query(
        `SELECT id, project_id, report_date, site_manager_id, overall_notes, status,
                approved_by, approved_at, submitted_at
         FROM daily_reports
         WHERE project_id = ? AND report_date BETWEEN ? AND ?
         ORDER BY report_date`,
        [projectId, startDate, endDate]
      );
      return rows;
    },

    /**
     * Record that a site manager will be on leave for a given period.
     * Called by Onboarding when PMC marks a leave. Writes to site_manager_leave,
     * which is owned by this module — callers outside M4 Site must go through
     * this function, never direct INSERT.
     *
     * @param {Object} params
     * @param {number} params.userId — the site manager going on leave
     * @param {number} params.projectId
     * @param {string} params.leaveFrom — ISO date
     * @param {string} params.leaveTo — ISO date
     * @param {string|null} params.reason
     * @param {number} params.markedBy — user id of the PMC recording the leave
     * @returns {Promise<{id:number}>}  the inserted row id
     */
    async recordSiteManagerLeave({ userId, projectId, leaveFrom, leaveTo, reason, markedBy }) {
      if (!userId || !projectId || !leaveFrom || !leaveTo) {
        throw new Error('userId, projectId, leaveFrom, leaveTo are required');
      }
      const [result] = await db.query(
        `INSERT INTO site_manager_leave
           (user_id, project_id, leave_from, leave_to, reason, marked_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, projectId, leaveFrom, leaveTo, reason || null, markedBy]
      );
      return { id: result.insertId };
    },

    /**
     * Acknowledge an AI-flagged anomaly on a daily report.
     * Called by M6 Reporting when the PMC clicks "acknowledge" on a flagged report.
     * Writes to daily_reports, owned by M4 Site — outside callers use this helper.
     *
     * Atomically updates only rows where ai_flag_acknowledged=0 (one-shot);
     * returns { affected } so the caller knows whether it took effect.
     */
    async acknowledgeDailyReportAnomaly(reportId) {
      if (!reportId) throw new Error('reportId is required');
      const [r] = await db.query(
        `UPDATE daily_reports
         SET ai_flag_acknowledged = 1, ai_flag_ack_at = NOW()
         WHERE id = ? AND ai_flag_acknowledged = 0`,
        [reportId]
      );
      return { affected: r.affectedRows };
    },

    /**
     * Bulk-approve all pending daily reports for a project.
     * Used by M6 Reporting's "approve-all" one-click action.
     * @returns {Promise<{approved:number}>}
     */
    async approveAllPendingDailyReports(projectId, approvedBy) {
      if (!projectId || !approvedBy) throw new Error('projectId and approvedBy are required');
      // Find pending ids first; bulk SM transitionMany filters on (id, from)
      const [rows] = await db.query(
        `SELECT id FROM daily_reports WHERE project_id = ? AND status = 'pending_review'`,
        [projectId]
      );
      if (!rows.length) return { approved: 0 };
      const sm = require('../../services/state-machines').dailyReport;
      const r = await sm.transitionMany({
        ids: rows.map(r => r.id),
        from: 'pending_review', to: 'approved',
        extraCols: { approved_by: approvedBy, approved_at: new Date() },
      });
      return { approved: r.affected };
    },

    /**
     * Flag a previously-approved daily report (un-approval).
     * PMC uses this when a report needs a second look after first-pass approval.
     */
    async flagDailyReport({ reportId, flaggedBy, reason }) {
      if (!reportId || !flaggedBy) throw new Error('reportId and flaggedBy are required');
      const [[cur]] = await db.query('SELECT status FROM daily_reports WHERE id = ?', [reportId]);
      if (!cur) throw new Error(`daily_report ${reportId} not found`);
      const sm = require('../../services/state-machines').dailyReport;
      await sm.transition({
        id: reportId, from: cur.status, to: 'flagged',
        extraCols: { flag_reason: reason || null, flagged_by: flaggedBy, flagged_at: new Date() },
      });
    },

    /**
     * Recent project photos for inclusion in weekly report generation.
     * @param {number} projectId
     * @param {string} sinceDate — ISO date; photos with photo_date >= this included
     * @param {number} limit — cap results (reports usually cap at 20)
     */
    async getRecentPhotos(projectId, sinceDate, limit = 20) {
      if (!projectId || !sinceDate) throw new Error('projectId and sinceDate are required');
      const [rows] = await db.query(
        `SELECT id, file_path, photo_date, caption
         FROM project_photos
         WHERE project_id = ? AND photo_date >= ?
           AND primary_entity_type = 'project_progress'
         ORDER BY photo_date DESC
         LIMIT ?`,
        [projectId, sinceDate, limit]
      );
      return rows;
    },

    /**
     * Open design-related issues (RFI/design flags) enriched with drawing
     * info. `issues` is Site-owned but references drawings — we JOIN across
     * the boundary in this single helper rather than exposing drawings to
     * every consumer. Filters out closed/resolved issues.
     */
    async getOpenDesignIssuesWithDrawings(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT dq.id, dq.description, dq.title, dq.issue_type,
                dq.status, dq.is_overdue, dq.raised_at, dq.raised_by,
                d.drawing_number, d.drawing_name AS drawing_title,
                dv.revision
         FROM issues dq
         LEFT JOIN drawing_versions dv ON dq.drawing_version_id = dv.id
         LEFT JOIN drawings d ON dv.drawing_id = d.id
         WHERE dq.project_id = ? AND dq.status != 'closed'
         ORDER BY dq.raised_at DESC`,
        [projectId]
      );
      return rows;
    },

    /**
     * BULK list-view stats for N projects. Returns a Map keyed by project_id
     * with { open_queries, overdue_queries } per project. One DB round-trip
     * regardless of N (perf guardrail for list views).
     *
     * Used by Onboarding's project list to compose per-row dashboards without
     * an N+1 loop.
     */
    /**
     * List site_manager_leave records for a project. No user JOIN — caller
     * uses Auth.getUsers to hydrate names in bulk.
     */
    async listManagerLeaveRecords(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT id, user_id, project_id, leave_from, leave_to, reason, marked_by, created_at AS marked_at
         FROM site_manager_leave
         WHERE project_id = ?
         ORDER BY leave_from DESC`,
        [projectId]
      );
      return rows;
    },

    /** Count issues matching filters for a single project OR across a project
     *  list. Covers COUNT(*) usage in projects.js / needs-you.js / acc-summary.js.
     *  
     *  @param {number|number[]} projectScope  single projectId or array of ids
     *  @param {object} filters   { issueTypes?: string[], statuses?: string[] }
     *  @returns {Promise<number>}  aggregate count
     * 
     *  Defaults: no filter on issue_types or statuses (count all).
     *  Statuses must be from issues.status enum.
     *  Empty array in projectScope returns 0 without hitting DB. */
    async countIssuesByFilter(projectScope, filters = {}) {
      const pids = Array.isArray(projectScope)
        ? [...new Set(projectScope.filter(Boolean))]
        : (projectScope ? [projectScope] : []);
      if (!pids.length) return 0;
      const { issueTypes, statuses } = filters;
      const where = [`project_id IN (${pids.map(() => '?').join(',')})`];
      const params = [...pids];
      if (Array.isArray(issueTypes) && issueTypes.length) {
        where.push(`issue_type IN (${issueTypes.map(() => '?').join(',')})`);
        params.push(...issueTypes);
      }
      if (Array.isArray(statuses) && statuses.length) {
        where.push(`status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
      const [[row]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM issues WHERE ${where.join(' AND ')}`,
        params
      );
      return row?.cnt || 0;
    },

    /** List issues matching filters with pre-computed age_days, ordered by age.
     *  Covers the pending.js "RFIs overdue" / "site issues overdue" queries.
     *  
     *  @param {object} opts {
     *    projectIds?: number[],   // omit to match all projects
     *    issueTypes?: string[],   // e.g. ['rfi','design']
     *    statuses?: string[],     // e.g. ['open','in_progress']
     *    minAgeDays?: number,     // only issues older than this
     *    limit?: number,          // default 50
     *  }
     *  @returns {Promise<Array>} rows with columns: id, title, issue_type,
     *    project_id, raised_at, age_days. */
    async listIssuesByFilter(opts = {}) {
      const { projectIds, issueTypes, statuses, minAgeDays, limit = 50 } = opts;
      // Explicit empty-array guard: caller passed projectIds=[] (e.g. user has
      // no project assignments) — return empty without hitting DB.
      if (Array.isArray(projectIds) && projectIds.length === 0) return [];
      const where = [];
      const params = [];
      if (Array.isArray(projectIds) && projectIds.length) {
        const pids = [...new Set(projectIds.filter(Boolean))];
        if (!pids.length) return [];
        where.push(`project_id IN (${pids.map(() => '?').join(',')})`);
        params.push(...pids);
      }
      if (Array.isArray(issueTypes) && issueTypes.length) {
        where.push(`issue_type IN (${issueTypes.map(() => '?').join(',')})`);
        params.push(...issueTypes);
      }
      if (Array.isArray(statuses) && statuses.length) {
        where.push(`status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
      if (typeof minAgeDays === 'number') {
        where.push(`TIMESTAMPDIFF(DAY, raised_at, NOW()) >= ?`);
        params.push(minAgeDays);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [rows] = await db.query(
        `SELECT id, title, issue_type, project_id, raised_at,
                TIMESTAMPDIFF(DAY, raised_at, NOW()) AS age_days
         FROM issues
         ${whereSql}
         ORDER BY raised_at ASC
         LIMIT ?`,
        [...params, limit]
      );
      return rows;
    },

    /** List drawing-query-style issues (issues with drawing_version_id set),
     *  optionally bucketed by age. Used by dashboard.js for overdue/fresh
     *  query splits.
     *  
     *  @param {object} opts { minAgeDays?, maxAgeDays? }  (inclusive-gte, exclusive-lt)
     *  @returns {Promise<Array>}  rows with description, raised_at, drawing_version_id, days_open */
    async listDrawingQueries(opts = {}) {
      const { minAgeDays, maxAgeDays } = opts;
      const where = [`status != 'closed'`, `drawing_version_id IS NOT NULL`];
      const params = [];
      if (typeof minAgeDays === 'number') {
        where.push(`DATEDIFF(NOW(), raised_at) >= ?`);
        params.push(minAgeDays);
      }
      if (typeof maxAgeDays === 'number') {
        where.push(`DATEDIFF(NOW(), raised_at) < ?`);
        params.push(maxAgeDays);
      }
      const [rows] = await db.query(
        `SELECT id, description, raised_at, project_id, drawing_version_id,
                DATEDIFF(NOW(), raised_at) AS days_open
         FROM issues
         WHERE ${where.join(' AND ')}
         ORDER BY days_open DESC`,
        params
      );
      return rows;
    },

    /** Fetch a single issue by id with the core columns. Returns null if not
     *  found. Used by design-services/drawings.js for RFI context. */
    async getIssueById(issueId) {
      if (!issueId) return null;
      const [rows] = await db.query(
        `SELECT id, project_id, issue_number, issue_type, title, description,
                raised_by, status, drawing_version_id, query_stream, rfi_response
         FROM issues WHERE id = ?`,
        [issueId]
      );
      return rows[0] || null;
    },
  },

  // ── ROUTE MOUNTS (server.js uses these) ─────────────────────────────────
  routes: {
    dailyReports: require('./routes/daily-reports'),
    grn:          require('./routes/grn'),
    issues:       require('./routes/issues'),
    photos:       require('./routes/photos'),
    photoTags:    require('./routes/photo-tags'),
    handover:     require('./routes/handover'),
    labour:       require('./routes/labour'),
    forms:        require('./routes/forms'),
    labourQuick:  require('./routes/labour-quick'),
  },

  // ── TABLES OWNED BY THIS MODULE ─────────────────────────────────────────
  // Only M4 Site writes to these. Other modules read via functions above.
  tables: [
    'daily_reports',
    'grns',
    'issues',
    'site_manager_leave',
    'project_photos',
    'entity_photo_links',
    'photo_tags',
    'labour_register',
    'labour_compliance',
    'site_checkins',
    'form_templates',
    'form_submissions',
  ],
};
