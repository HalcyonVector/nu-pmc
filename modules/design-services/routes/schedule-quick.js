// routes/schedule-quick.js — A3, friction-reduction brief
//
// GET  /api/schedule-quick/:project_id
//   Returns today's active tasks with their last known progress % for pre-fill.
//
// POST /api/schedule-quick/:project_id
//   Body: { date, updates: [{ task_id, pct_complete, notes }] }
//   Bulk progress update — calls same task_updates insert as the existing
//   PATCH /schedule/:project_id/tasks/:id/progress but without regression check
//   (mini-form is for quick daily updates; full regression logic applies in PWA).

'use strict';

const express      = require('express');
const db           = require('../../../middleware/db');
const { requireAuth, requireProjectScope } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit        = require('../../../services/audit');
const router       = express.Router();

// ── GET /api/schedule-quick/:project_id — today's tasks + last progress for pre-fill
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.project_id, 10);
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // Active tasks that are in progress (started, not complete) for this project
  const [tasks] = await db.query(
    `SELECT st.id AS task_id, st.task_name, st.trade, st.start_date, st.end_date,
            st.float_days, st.milestone_type,
            COALESCE(tu.pct_complete, 0) AS pct_complete,
            tu.report_date AS last_updated
       FROM schedule_tasks st
       LEFT JOIN task_updates tu ON tu.task_id = st.id
         AND tu.report_date = (
           SELECT MAX(tu2.report_date) FROM task_updates tu2 WHERE tu2.task_id = st.id
         )
      WHERE st.project_id = ?
        AND st.status NOT IN ('completed','not_started')
        AND st.start_date <= ?
      ORDER BY st.float_days ASC, st.start_date ASC
      LIMIT 20`,
    [projectId, today]
  );

  res.json({ project_id: projectId, date: today, tasks });
}));

// ── POST /api/schedule-quick/:project_id — bulk progress update
router.post('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const me        = req.session.user;
  const projectId = parseInt(req.params.project_id, 10);
  const { date, updates } = req.body;

  if (!date || !Array.isArray(updates) || !updates.length) {
    return res.status(400).json({ error: 'date and updates[] required' });
  }

  const canUpdate = ['site_manager','senior_site_manager','pmc_head','principal','design_principal'].includes(me.role);
  if (!canUpdate) return res.status(403).json({ error: 'Not authorised' });

  let saved = 0;

  for (const upd of updates) {
    const taskId = parseInt(upd.task_id, 10);
    const pct    = Math.max(0, Math.min(100, parseInt(upd.pct_complete ?? 0, 10)));
    if (!taskId) continue;

    await db.query(
      `INSERT INTO task_updates
         (task_id, project_id, report_date, pct_complete, notes, is_flagged, updated_by)
       VALUES (?,?,?,?,?,0,?)
       ON DUPLICATE KEY UPDATE
         pct_complete = VALUES(pct_complete),
         notes        = VALUES(notes),
         updated_by   = VALUES(updated_by)`,
      [taskId, projectId, date, pct, upd.notes || null, me.id]
    );
    saved++;
  }

  audit.log({ userId: me.id, action: 'schedule.quick_update',
    entityType: 'task_updates', entityId: null,
    details: { project_id: projectId, date, saved }, req });

  res.json({ success: true, saved });
}));

module.exports = router;
