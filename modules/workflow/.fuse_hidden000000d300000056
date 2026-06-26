// modules/workflow/contract.js
// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW MODULE — PUBLIC CONTRACT
// ═══════════════════════════════════════════════════════════════════════════
// Owns multi-party approval and record-keeping workflows that span
// multiple functional areas of a project.
//
// - Meetings (unified site visits + MOMs with revisions, action items, photos)
// - Change notices (scope / schedule / cost changes with multi-signatory flow)
// - Approvals dispatcher (routes approval requests to schedule / weekly /
//   budget owners; cross-module read-heavy)
// - Measurements (joint measurement & certification for completed work)
// - Submittals (numbered register of submissions to client / consultant)
// ═══════════════════════════════════════════════════════════════════════════

const db = require('../../middleware/db');

module.exports = {
  version: '1.0.0',

  functions: {
    /** Get a meeting by id (optionally filtering by project for scope). */
    async getMeeting(meetingId, projectId = null) {
      const params = [meetingId];
      let where = 'id = ?';
      if (projectId) { where += ' AND project_id = ?'; params.push(projectId); }
      const [rows] = await db.query(
        `SELECT id, project_id, client_id, meeting_number, type, title,
                meeting_date, location, visibility, created_at
         FROM meetings WHERE ${where}`,
        params
      );
      return rows[0] || null;
    },

    /** Recent meetings for a project (limit defaults to 20). */
    async getRecentMeetings(projectId, limit = 20) {
      const [rows] = await db.query(
        `SELECT id, meeting_number, type, title, meeting_date, visibility
         FROM meetings WHERE project_id = ?
         ORDER BY meeting_date DESC LIMIT ?`,
        [projectId, Number(limit) || 20]
      );
      return rows;
    },

    /** Open change notices (not yet fully signed off) for a project. */
    async getOpenChangeNotices(projectId) {
      const [rows] = await db.query(
        `SELECT cn.id, cn.cn_number, cn.title, cn.status, cn.raised_at,
                cn.boq_impact, cn.schedule_impact_days
         FROM change_notices cn
         WHERE cn.project_id = ?
           AND cn.status NOT IN ('signed_off', 'rejected', 'withdrawn')
         ORDER BY cn.raised_at DESC`,
        [projectId]
      );
      return rows;
    },

    /** Submittals register for a project. */
    async getSubmittals(projectId) {
      const [rows] = await db.query(
        `SELECT id, submittal_number, title, status, submitted_at, project_id
         FROM submittals WHERE project_id = ?
         ORDER BY submitted_at DESC`,
        [projectId]
      );
      return rows;
    },

    /** Measurement records for a project. */
    async getMeasurements(projectId) {
      const [rows] = await db.query(
        `SELECT id, ra_bill_number, discipline, measurement_date, status, project_id
         FROM measurements WHERE project_id = ?
         ORDER BY measurement_date DESC`,
        [projectId]
      );
      return rows;
    },

    /**
     * Create or update a MoM (meeting of minutes) action item.
     * If `id` is provided, UPDATE that row; otherwise INSERT a new row.
     * Used by M6 Reporting's weekly-report MoM editor, which handles both
     * new and existing items in the same batch-save operation.
     *
     * @param {Object} params
     * @param {number|null} params.id — if set, update that row; else insert
     * @param {number} params.projectId
     * @param {string} params.description
     * @param {string} params.responsible
     * @param {string} params.remarks
     * @param {string} params.trade
     * @param {string} params.status — 'open' | 'in_progress' | 'closed'
     * @param {string|null} params.resolutionNote — required if status='closed'
     * @param {number} params.actorId — userId of PMC doing the save
     * @returns {Promise<{id:number}>}
     */
    async upsertMomItem({ id, projectId, description, responsible, remarks, trade, status, resolutionNote, actorId }) {
      if (!projectId || !actorId) throw new Error('projectId and actorId are required');
      if (status === 'closed' && !resolutionNote) {
        throw new Error('resolutionNote is required when status=closed');
      }
      if (id) {
        // Read current state to decide if this is a status change or just
        // a metadata edit. State changes go through the state machine;
        // metadata-only edits stay raw.
        const [[cur]] = await db.query('SELECT status FROM mom_items WHERE id = ?', [id]);
        if (!cur) throw new Error(`mom_item ${id} not found`);

        if (cur.status !== status) {
          // Status is changing — go through state machine for the transition,
          // then a follow-up UPDATE for the metadata fields. Two writes, but
          // the SM enforces the open→closed edge.
          const sm = require('../../services/state-machines').momItem;
          await sm.transition({
            id, from: cur.status, to: status,
            extraCols: { resolution_note: resolutionNote || null },
          });
          // Metadata-only follow-up
          await db.query(
            `UPDATE mom_items SET remarks = ?, responsible = ?, updated_at = NOW() WHERE id = ?`,
            [remarks, responsible, id]
          );
        } else {
          // Same status — just a metadata edit.
          await db.query(
            `UPDATE mom_items
                SET resolution_note = ?, remarks = ?, responsible = ?, updated_at = NOW()
              WHERE id = ?`,
            [resolutionNote || null, remarks, responsible, id]
          );
        }
        return { id };
      }
      if (!description) throw new Error('description is required for new items');
      const [r] = await db.query(
        `INSERT INTO mom_items
         (project_id, description, responsible, remarks, trade, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [projectId, description, responsible, remarks || '', trade || '', status || 'open', actorId]
      );
      return { id: r.insertId };
    },

    /**
     * Latest open MoM items for a project — used by weekly report carry-forward.
     * Returns items where status != 'closed', ordered newest first.
     */
    async getLatestOpenMomItems(projectId, limit = 50) {
      if (!projectId) throw new Error('projectId is required');
      const [rows] = await db.query(
        `SELECT id, project_id, description, responsible, remarks, trade, status, created_at
         FROM mom_items
         WHERE project_id = ? AND status != 'closed'
         ORDER BY created_at DESC
         LIMIT ?`,
        [projectId, limit]
      );
      return rows;
    },

    /**
     * Most recent site-visit meeting for a project, with the drafter's user id.
     * Used by weekly report generator to pull site-visit observations.
     * Returns null if no site-visit meeting recorded.
     */
    async getMostRecentSiteVisit(projectId) {
      if (!projectId) throw new Error('projectId is required');
      const [[row]] = await db.query(
        `SELECT sv.id, sv.drafted_by, sv.meeting_date,
                GROUP_CONCAT(svo.action_text SEPARATOR '|') AS observations
         FROM meetings sv
         LEFT JOIN meeting_actions svo ON svo.meeting_id = sv.id
         WHERE sv.project_id = ? AND sv.type = 'site_visit'
         GROUP BY sv.id
         ORDER BY sv.meeting_date DESC
         LIMIT 1`,
        [projectId]
      );
      return row || null;
    },

    /**
     * All site-visit observations within a date range, with visitor user id.
     * Names are left to the caller (via Auth.getUsers) to avoid a cross-module JOIN.
     * @returns {Promise<Array<{id, observation, visitor_id, visit_date, ...}>>}
     */
    async getSiteVisitObservationsBetween(projectId, startDate, endDate) {
      if (!projectId || !startDate || !endDate) {
        throw new Error('projectId, startDate and endDate are required');
      }
      const [rows] = await db.query(
        `SELECT svo.*,
                sv.drafted_by AS visitor_id,
                sv.meeting_date AS visit_date
         FROM meeting_actions svo
         JOIN meetings sv ON svo.meeting_id = sv.id AND sv.type = 'site_visit'
         WHERE sv.project_id = ? AND sv.meeting_date >= ? AND sv.meeting_date <= ?`,
        [projectId, startDate, endDate]
      );
      return rows;
    },

    /**
     * List MoM items with optional status filter. Used by the
     * reporting /mom-items GET endpoint.
     * @param {number} projectId
     * @param {Object} filter — { status?: string, limit?: number }
     */
    async listMomItems(projectId, { status, limit = 200 } = {}) {
      if (!projectId) throw new Error('projectId is required');
      const params = [projectId];
      let where = 'project_id = ?';
      if (status) { where += ' AND status = ?'; params.push(status); }
      params.push(limit);
      const [rows] = await db.query(
        `SELECT id, project_id, description, responsible, remarks, trade, status,
                resolution_note, created_by, created_at, updated_at
         FROM mom_items
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT ?`,
        params
      );
      return rows;
    },
  },

  routes: {
    meetings:     require('./routes/meetings'),
    changes:      require('./routes/changes'),
    approvals:    require('./routes/approvals'),
    measurements: require('./routes/measurements'),
    submittals:   require('./routes/submittals'),
  },

  tables: [
    'meetings',
    'meeting_actions',
    'meeting_revisions',
    'project_photos',
    'mom_items',
    'change_notices',
    'change_notice_signatories',
    'measurements',
    'measurement_items',
    'submittals',
    'workflow_transitions',
  ],
};
