// modules/onboarding/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// M2 ONBOARDING MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// Owns the "setting up a project" phase: project records, clients, vendor
// master + clearance, internal team assignment, client BOQ, document library.
//
// Callers only import from this file. Do not reach into routes/middleware/.
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  // ── FUNCTIONS (async helpers other modules may call) ────────────────────
  functions: {
    /** Return a project record by id, or null if missing. */
    async getProject(projectId) {
      const [rows] = await db.query(
        `SELECT id, entity_id, billing_account, code, name, client, client_id,
                location, project_type, r0_start_date, r0_end_date, status,
                contract_value, jurisdiction,
                payment_approval_threshold
         FROM projects WHERE id = ?`,
        [projectId]
      );
      return rows[0] || null;
    },

    /** Return the client record for a project (via project.client_id).
     *  Returns { id, client_name, address, gstin, master_complete } or null. */
    async getClient(projectId) {
      const [rows] = await db.query(
        `SELECT c.id, c.client_name, c.address, c.gstin, c.master_complete
         FROM clients c JOIN projects p ON p.client_id = c.id
         WHERE p.id = ?`,
        [projectId]
      );
      return rows[0] || null;
    },

    /** Return the client BOQ items for a project (rate cards for billing). */
    async getClientBOQ(projectId) {
      const [rows] = await db.query(
        `SELECT id, boq_version_id, item_code, item_name, unit, quantity,
                client_rate, hsn_code, display_order
         FROM client_boq_items
         WHERE project_id = ?
         ORDER BY display_order`,
        [projectId]
      );
      return rows;
    },

    /** Return vendors who have cleared finance checks (ready to engage). */
    async getClearedVendors(trade = null) {
      const params = [];
      let sql = `SELECT id, trade, vendor_name, phone, gst_number,
                        pan_validated, gstin_validated, bank_verified
                 FROM vendors
                 WHERE is_active = 1
                   AND pan_validated = 1 AND gstin_validated = 1`;
      if (trade) { sql += ` AND trade = ?`; params.push(trade); }
      sql += ` ORDER BY vendor_name`;
      const [rows] = await db.query(sql, params);
      return rows;
    },

    /** Return the project team assignments. */
    async getProjectTeam(projectId) {
      const [rows] = await db.query(
        `SELECT pa.user_id, pa.role AS assignment_role,
                u.username, u.full_name, u.role AS user_role
         FROM project_assignments pa
         JOIN users u ON pa.user_id = u.id
         WHERE pa.project_id = ? AND pa.is_active = 1
         ORDER BY u.role, u.full_name`,
        [projectId]
      );
      return rows;
    },

    /** Return a vendor engagement by id (or null). Used by Finance. */
    async getVendorEngagement(engagementId) {
      const [rows] = await db.query(
        `SELECT ve.id, ve.vendor_id, ve.project_id, ve.scope, ve.contract_value,
                ve.mobilisation_status, ve.approval_status, ve.approved_by, ve.approved_at,
                v.vendor_name, v.trade, v.gst_number, v.bank_account, v.bank_ifsc
         FROM vendor_engagements ve
         JOIN vendors v ON ve.vendor_id = v.id
         WHERE ve.id = ?`,
        [engagementId]
      );
      return rows[0] || null;
    },

    /** Approved engagements for a project (Finance + Reporting consume this). */
    async getApprovedEngagements(projectId) {
      const [rows] = await db.query(
        `SELECT ve.id, ve.vendor_id, ve.project_id, ve.scope, ve.contract_value,
                ve.mobilisation_status, v.vendor_name, v.trade
         FROM vendor_engagements ve
         JOIN vendors v ON ve.vendor_id = v.id
         WHERE ve.project_id = ? AND ve.approval_status = 'approved'
         ORDER BY v.vendor_name`,
        [projectId]
      );
      return rows;
    },

    /** Active projects across the firm (status = 'active'). Used by dashboards + weekly health. */
    async getActiveProjects() {
      const [rows] = await db.query(
        `SELECT id, code, name, client, location, status, r0_start_date, r0_end_date
         FROM projects
         WHERE status = 'active'
         ORDER BY name`
      );
      return rows;
    },

    /**
     * True if the user has an active assignment to the given project.
     * Used by M6 Reporting to gate weekly-report upload access.
     * Firm-wide roles (principals, audit, finance_admin) are assigned to all
     * projects implicitly — this helper checks the explicit assignment table
     * only, so callers must combine with role checks for firm-wide access.
     */
    async isUserAssignedToProject(userId, projectId) {
      if (!userId || !projectId) return false;
      const [rows] = await db.query(
        `SELECT id FROM project_assignments
         WHERE project_id = ? AND user_id = ? AND is_active = 1`,
        [projectId, userId]
      );
      return rows.length > 0;
    },

    /** Bulk vendor lookup. Accepts id list (can contain duplicates / nulls);
     *  returns Map<id, vendor row>. Callers can either .get(id) or spread.
     *  Row shape matches vendors.* full row — callers pick what they need. */
    async getVendorsByIds(ids) {
      const clean = [...new Set((ids || []).filter(Boolean))];
      if (!clean.length) return new Map();
      const placeholders = clean.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT * FROM vendors WHERE id IN (${placeholders})`,
        clean
      );
      return new Map(rows.map(r => [r.id, r]));
    },

    /** Bulk engagement lookup. Joins vendors inline so callers never need
     *  a separate vendor query for names/trades. Returns Map<engagement_id, row>. */
    async getEngagementsByIds(ids) {
      const clean = [...new Set((ids || []).filter(Boolean))];
      if (!clean.length) return new Map();
      const placeholders = clean.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT ve.*, v.vendor_name, v.trade, v.phone AS vendor_phone,
                v.gst_number, v.bank_name, v.bank_account, v.bank_ifsc,
                v.clearance_status, v.bank_validated_by_vendor
         FROM vendor_engagements ve
         JOIN vendors v ON ve.vendor_id = v.id
         WHERE ve.id IN (${placeholders})`,
        clean
      );
      return new Map(rows.map(r => [r.id, r]));
    },

    /** List vendor engagements on a project, optionally filtered to active ones.
     *  Joins vendors inline so callers get vendor_name/trade/id without a second
     *  query. Used by BOQ-mapping, payment sheets, vendor-engagement dashboards.
     *  Returns array of rows (not a Map — callers typically iterate, not look up by id). */
    async listEngagementsByProject(projectId, { activeOnly = true } = {}) {
      const where = activeOnly ? 'AND ve.is_active = 1' : '';
      const [rows] = await db.query(
        `SELECT ve.id, ve.vendor_id, ve.project_id, ve.scope, ve.contract_value,
                ve.mobilisation_status, ve.approval_status, ve.is_active,
                v.vendor_name, v.trade, v.phone AS vendor_phone,
                v.bank_account, v.bank_ifsc, v.bank_name, v.gst_number,
                v.clearance_status, v.pan_validated
         FROM vendor_engagements ve
         JOIN vendors v ON ve.vendor_id = v.id
         WHERE ve.project_id = ? ${where}
         ORDER BY v.vendor_name`,
        [projectId]
      );
      return rows;
    },

    /** Bulk project lookup. Primary use: JOIN-replacement in list endpoints
     *  that hydrate project name/code/client/location for display.
     *  Returns Map<project_id, row> — missing ids are simply absent from the map. */
    async getProjectsByIds(ids) {
      const clean = [...new Set((ids || []).filter(Boolean))];
      if (!clean.length) return new Map();
      const placeholders = clean.map(() => '?').join(',');
      const [rows] = await db.query(
        `SELECT id, entity_id, billing_account, code, name, client, client_id,
                location, project_type, r0_start_date, r0_end_date, status,
                contract_value, jurisdiction,
                payment_approval_threshold
         FROM projects WHERE id IN (${placeholders})`,
        clean
      );
      return new Map(rows.map(r => [r.id, r]));
    },

    /** Set a boolean checklist flag on a project. Whitelist-guarded — callers
     *  can only set flags design-services/finance/workflow actually need.
     *  Throws TypeError on unknown flag names (fail loud in dev, not silently).
     *  
     *  Accepts an optional connection object for transaction context — pass
     *  the `conn` from inside a `db.transaction()` callback to include this
     *  write in that transaction. When omitted, uses the module-level pool.
     *  
     *  Returns true if row was updated, false if project_id did not exist. */
    async setChecklistFlag(projectId, flagName, conn = null) {
      const ALLOWED = new Set([
        'checklist_design_boq',
        'checklist_services_boq',
        'checklist_schedule',
        'checklist_design_register',
        'checklist_services_register',
      ]);
      if (!ALLOWED.has(flagName)) {
        throw new TypeError(
          `setChecklistFlag: '${flagName}' is not a whitelisted checklist flag. ` +
          `Allowed: ${[...ALLOWED].join(', ')}`
        );
      }
      const runner = conn || db;
      const [res] = await runner.query(
        `UPDATE projects SET ${flagName} = 1 WHERE id = ?`,
        [projectId]
      );
      return res.affectedRows > 0;
    },
  },

  // ── ROUTE MOUNTS (server.js uses these) ─────────────────────────────────
  routes: {
    projects:      require('./routes/projects'),
    clients:       require('./routes/clients'),
    projectSetup:  require('./routes/project-setup'),
    clientBOQ:     require('./routes/client-boq'),
    vendors:       require('./routes/vendors'),
    documents:     require('./routes/documents'),
    vendorPublic:  require('./routes/vendor-public'),
  },

  // ── TABLES OWNED BY THIS MODULE ─────────────────────────────────────────
  // Other modules may SELECT from these via functions above; not INSERT/UPDATE.
  tables: [
    'projects',
    'project_assignments',
    'project_scope',
    'project_setup_tracking',
    'setup_checklist_items',
    'setup_checklist_templates',
    'clients',
    'company_entities',
    'vendors',
    'vendor_engagements',
    'vendor_contract_history',
    'vendor_acknowledgements',
    'client_boq_items',
    'client_boq_versions',
    'project_documents',
    'project_document_versions',
    'approval_document_links',
  ],
};
