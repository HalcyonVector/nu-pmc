// modules/reporting/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M6 REPORTING MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// Aggregates + presents data from other modules. Consumes — doesn't own —
// most of what it shows. Minimal state of its own (scheduled report runs,
// cached digests).
//
// - Dashboard summaries
// - Accordion badge counts (tab-level counters)
// - Needs-you counts (per-role pending count)
// - Pending tab contents
// - Weekly Monday health report
// - Weekly sign-off state
// - Gantt chart data
// - Ad-hoc reports
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  functions: {
    /**
     * Counts for the "Needs You" tab — how many items await this user's action.
     * Backed by the existing /api/needs-you logic; exposed as a function so
     * other consumers (dashboard, mobile push-badge service) can reuse.
     */
    async getNeedsYouCount(userId, role) {
      // Mirror the same logic as GET /api/needs-you/me but as a count-only summary.
      // Used by dashboard badges and push-notification services.
      try {
        const { PROJECT_SCOPED_ROLES } = require('../../middleware/auth');
        let projectIds = null;
        if (PROJECT_SCOPED_ROLES.includes(role)) {
          const [rows] = await db.query(
            `SELECT pa.project_id FROM project_assignments pa
             JOIN projects p ON pa.project_id = p.id
             WHERE pa.user_id = ? AND pa.is_active = 1 AND p.status != 'completed'`,
            [userId]
          );
          projectIds = rows.map(r => r.project_id);
          if (projectIds.length === 0) return { userId, role, count: 0 };
        }

        const scope = projectIds ? ' AND project_id IN (?)' : '';
        const params = projectIds ? [projectIds] : [];

        let count = 0;
        if (role === 'pmc_head') {
          const [[r]] = await db.query(`SELECT
            (SELECT COUNT(*) FROM daily_reports    WHERE status='pending_review'${scope}) +
            (SELECT COUNT(*) FROM meetings         WHERE status='draft'${scope}) +
            (SELECT COUNT(*) FROM payment_requests WHERE status='pending_pmc'${scope}) +
            (SELECT COUNT(*) FROM grns             WHERE status='pending'${scope}) AS total`,
            [...params, ...params, ...params, ...params]);
          count = parseInt(r.total || 0);
        } else if (['principal','design_principal'].includes(role)) {
          const [[r]] = await db.query(`SELECT
            (SELECT COUNT(*) FROM payment_requests WHERE status='pmc_approved'${scope}) +
            (SELECT COUNT(*) FROM schedule_versions WHERE status='pending_approval'${scope}) AS total`,
            [...params, ...params]);
          count = parseInt(r.total || 0);
        } else if (['site_manager','senior_site_manager'].includes(role)) {
          const [[r]] = await db.query(`SELECT
            (SELECT COUNT(*) FROM grns WHERE status='pending'${scope}) AS total`,
            [...params]);
          count = parseInt(r.total || 0);
        } else if (role === 'audit') {
          const [[r]] = await db.query(`SELECT
            (SELECT COUNT(*) FROM payment_requests WHERE status IN ('pending_pmc','pending_principal','pmc_approved')${scope}) AS total`,
            [...params]);
          count = parseInt(r.total || 0);
        }
        return { userId, role, count };
      } catch (e) {
        return { userId, role, count: 0 };
      }
    },

    /**
     * Weekly health status for a project as of a given week-ending date.
     * Currently read-only summary; real computation lives in weekly-health.js.
     * The underlying table is `weekly_reports` and uses week_ending (not week_start).
     */
    async getWeeklyHealthSummary(projectId, weekEnding) {
      const [rows] = await db.query(
        `SELECT id, project_id, week_ending, status, approved_at
         FROM weekly_reports
         WHERE project_id = ? AND week_ending = ?
         ORDER BY approved_at DESC LIMIT 1`,
        [projectId, weekEnding]
      ).catch(() => [[]]);
      return rows?.[0] || null;
    },

    /**
     * Triggers AI lessons-learned draft generation for a project retrospective.
     */
    async generateAIDraftForProject(projectId) {
      const lessons = require('./routes/lessons');
      return lessons.generateAIDraftForProject(projectId);
    },
  },

  routes: {
    reports:       require('./routes/reports'),
    weeklyHealth:  require('./routes/weekly-health'),
    weeklySignoff: require('./routes/weekly-signoff'),
    dashboard:     require('./routes/dashboard'),
    accSummary:    require('./routes/acc-summary'),
    needsYou:      require('./routes/needs-you'),
    pending:       require('./routes/pending'),
    gantt:         require('./routes/gantt'),
    lessons:       require('./routes/lessons'),
  },

  tables: [
    'weekly_reports',
    'project_photos', 'entity_photo_links',
    'weekly_report_documents',
    'schedule_risk_narratives',
  ],
};
