// modules/system/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M7 SYSTEM MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// Cross-cutting system services: navigation config, notifications/WhatsApp,
// AI triggers, governance/permissions, delegations, PMC admin, lookups.
//
// Used by every other module indirectly (e.g. Finance uses notifications
// to WA approve/reject events; Onboarding uses AI triggers for drawing
// review). Kept as its own module so these concerns don't leak into every
// other module's concerns.
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  functions: {
    /** Role-aware nav configuration — what tabs should this role see? */
    async getNavForRole(role) {
      const [rows] = await db.query(
        `SELECT role, bucket, tab_key, sort_order, is_visible
         FROM role_nav WHERE role = ? AND is_visible = 1
         ORDER BY bucket, sort_order`,
        [role]
      ).catch(() => [[]]);
      return rows || [];
    },

    /** Return SLAs configured for a specific project, or app defaults. */
    async getSLAsForProject(projectId) {
      const [rows] = await db.query(
        `SELECT project_id, item_type, sla_days FROM project_slas WHERE project_id = ?`,
        [projectId]
      ).catch(() => [[]]);
      return rows || [];
    },
  },

  routes: {
    nav:             require('./routes/nav'),
    navAdmin:        require('./routes/nav-admin'),
    projectSlas:     require('./routes/project-slas'),
    notifications:   require('./routes/notifications'),
    whatsapp:        require('./routes/whatsapp').router,
    comms:           require('./routes/comms'),
    governance:      require('./routes/governance'),
    delegations:     require('./routes/delegations'),
    aiTriggers:      require('./routes/ai-triggers'),
    pmcAssignments:  require('./routes/pmc-assignments'),
    lookup:          require('./routes/lookup'),
    companyEntities: require('./routes/company-entities'),
    clientErrors:    require('./routes/client-errors'),
    clientErrorsRead: require('./routes/client-errors').readRouter,
  },

  tables: [
    'role_nav',
    'role_nav_drafts',
    'role_nav_audit',
    'role_permissions',
    'project_slas',
    'notification_triggers',
    'whatsapp_notifications',
    'wa_send_failures',
    'failed_emails',
    'client_comms',
    'comms_log',
    'delegations',
    'project_pmc_assignments',
    'governance_uploads',
    'audit_log',
    'date_sanity_checks',
    'validation_retry_queue',
    'archival_log',
  ],
};
