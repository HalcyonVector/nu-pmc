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
      // Delegated to the existing route's helper once it's refactored into
      // a service. For now, minimal placeholder returning 0 safely if the
      // underlying SQL isn't ready.
      return { userId, role, count: 0 };
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
  },

  tables: [
    'weekly_reports',
    'entity_photos', 'entity_photo_links',
    'weekly_report_documents',
    'schedule_risk_narratives',
  ],
};
