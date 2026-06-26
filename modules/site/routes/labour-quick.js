// routes/labour-quick.js — A2, friction-reduction brief
//
// GET  /api/labour-quick/:project_id
//   Returns yesterday's headcounts per engagement (pre-fill) +
//   active engagements list (for any that have no yesterday entry) +
//   today's date. Frontend renders the pre-filled form.
//
// POST /api/labour-quick/:project_id
//   Body: { date, entries: [{ engagement_id, vendor_name, headcount, unregistered }] }
//   Bulk-inserts into labour_register via existing ON DUPLICATE KEY UPDATE logic.
//   Unregistered vendors (typed name, no engagement_id) get a placeholder row.
//
// GET  /api/labour-quick/vendors/search?q=ABC&project_id=1
//   Typeahead: searches vendors master by name prefix. Returns id + name for
//   the autocomplete dropdown on the "+ Add vendor" row.

'use strict';

const express      = require('express');
const db           = require('../../../middleware/db');
const { requireAuth, requireProjectScope } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit        = require('../../../services/audit');
const router       = express.Router();

// ── GET /api/labour-quick/vendors/search — typeahead from vendors master
// Must be registered BEFORE /:project_id to avoid conflict.
router.get('/vendors/search', requireAuth, asyncHandler(async (req, res) => {
  const q          = String(req.query.q || '').trim();
  const projectId  = req.query.project_id ? parseInt(req.query.project_id, 10) : null;
  if (!q || q.length < 1) return res.json({ vendors: [] });

  // Search vendors master — name starts with or contains the query
  // Prefer vendors already engaged on this project (show them first)
  const params = [`${q}%`, `%${q}%`];
  let sql = `
    SELECT v.id, v.vendor_name, v.trade,
           MAX(ve.project_id = ?) AS on_project
      FROM vendors v
      LEFT JOIN vendor_engagements ve ON ve.vendor_id = v.id AND ve.is_active = 1
     WHERE v.is_active = 1
       AND (v.vendor_name LIKE ? OR v.vendor_name LIKE ?)
     GROUP BY v.id
     ORDER BY on_project DESC, v.vendor_name ASC
     LIMIT 10`;
  const [vendors] = await db.query(sql, [projectId || 0, ...params]);
  res.json({ vendors });
}));

// ── GET /api/labour-quick/:project_id — pre-fill data for the form
router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const projectId  = parseInt(req.params.project_id, 10);
  const today      = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const yesterday  = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // 1. Active engagements for this project
  const [engagements] = await db.query(
    `SELECT ve.id AS engagement_id, v.id AS vendor_id, v.vendor_name, ve.trade
       FROM vendor_engagements ve
       JOIN vendors v ON v.id = ve.vendor_id
      WHERE ve.project_id = ? AND ve.is_active = 1
      ORDER BY v.vendor_name ASC`,
    [projectId]
  );

  // 2. Yesterday's headcounts for pre-fill
  const [yesterday_entries] = await db.query(
    `SELECT engagement_id, headcount, notes
       FROM labour_register
      WHERE project_id = ? AND register_date = ?`,
    [projectId, yesterday]
  );
  const yesterdayMap = new Map(yesterday_entries.map(e => [e.engagement_id, e]));

  // 3. Merge — each engagement gets its yesterday count (or 0)
  const rows = engagements.map(eng => ({
    engagement_id: eng.engagement_id,
    vendor_id:     eng.vendor_id,
    vendor_name:   eng.vendor_name,
    trade:         eng.trade,
    headcount:     yesterdayMap.get(eng.engagement_id)?.headcount ?? 0,
    yesterday_headcount: yesterdayMap.get(eng.engagement_id)?.headcount ?? 0,
  }));

  res.json({ project_id: projectId, date: today, rows });
}));

// ── POST /api/labour-quick/:project_id — bulk submit from mini-form
router.post('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
  const me        = req.session.user;
  const projectId = parseInt(req.params.project_id, 10);
  const { date, entries } = req.body;

  if (!date || !Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'date and entries[] required' });
  }

  const canEnter = ['site_manager','senior_site_manager','pmc_head','principal','design_principal'].includes(me.role);
  if (!canEnter) return res.status(403).json({ error: 'Site managers and PMC only' });

  let inserted = 0;
  let skipped  = 0;

  for (const entry of entries) {
    const headcount = parseInt(entry.headcount ?? 0, 10);
    if (headcount < 0) continue;

    if (entry.engagement_id && !entry.unregistered) {
      // Known vendor — standard labour_register insert with ON DUPLICATE KEY UPDATE
      await db.query(
        `INSERT INTO labour_register
           (project_id, engagement_id, register_date, trade, headcount, recorded_by)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           headcount    = VALUES(headcount),
           recorded_by  = VALUES(recorded_by)`,
        [projectId, entry.engagement_id, date,
         entry.trade || null, headcount, me.id]
      );
      inserted++;
    } else if (entry.vendor_name && entry.unregistered) {
      // Unregistered vendor — record with NULL engagement_id, flagged for follow-up
      await db.query(
        `INSERT INTO labour_register
           (project_id, engagement_id, register_date, trade, headcount, notes, recorded_by)
         VALUES (?,NULL,?,?,?,?,?)`,
        [projectId, date, entry.trade || null, headcount,
         `[UNREGISTERED] ${String(entry.vendor_name).slice(0, 100)}`, me.id]
      );
      inserted++;
    } else {
      skipped++;
    }
  }

  audit.log({ userId: me.id, action: 'labour.quick_submit',
    entityType: 'labour_register', entityId: null,
    details: { project_id: projectId, date, inserted, skipped }, req });

  res.json({ success: true, inserted, skipped });
}));

module.exports = router;
