// routes/labour.js — Labour register, daily headcount per contractor per trade
const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePMC, requireProjectScope } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router  = express.Router();

router.get('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    let q = `SELECT * FROM labour_register WHERE project_id = ?`;
    const params = [req.params.project_id];
    if (from) { q += ' AND register_date >= ?'; params.push(from); }
    if (to)   { q += ' AND register_date <= ?'; params.push(to); }
    q += ' ORDER BY register_date DESC';
    const [records] = await db.query(q, params);
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(records.map(r => r.recorded_by).filter(Boolean));
    const Onboarding = require('../../onboarding/contract');
    const engs = await Onboarding.functions.getEngagementsByIds(records.map(r => r.engagement_id));
    records.forEach(r => {
      const e = engs.get(r.engagement_id);
      r.recorded_by_name = users.get(r.recorded_by)?.full_name || null;
      r.vendor_name      = e?.vendor_name || null;
      r.vendor_trade     = e?.trade || null;
    });
    // Secondary sort by vendor_name within same register_date (was an ORDER BY clause on the join)
    records.sort((a, b) => {
      if (a.register_date !== b.register_date) return a.register_date < b.register_date ? 1 : -1;
      return (a.vendor_name || '').localeCompare(b.vendor_name || '');
    });

    // Weekly summary
    const [[weekTotal]] = await db.query(
      `SELECT SUM(headcount) AS total_headcount, SUM(wages_paid) AS total_wages
       FROM labour_register WHERE project_id = ?
       AND register_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
      [req.params.project_id]
    );
    res.json({ records, week_summary: weekTotal });
  }));

router.post('/:project_id', requireAuth, requireProjectScope(), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const canEnter = ['site_manager','senior_site_manager','pmc_head',
                      'principal','design_principal'].includes(me.role);
    if (!canEnter) return res.status(403).json({ error: 'Site managers and PMC only' });

    const { engagement_id, register_date, trade, headcount, wages_paid, notes } = req.body;
    if (!engagement_id || !register_date || !trade || headcount === undefined) {
      return res.status(400).json({ error: 'Engagement, date, trade and headcount required' });
    }
    await db.query(
      `INSERT INTO labour_register (project_id, engagement_id, register_date, trade, headcount, wages_paid, notes, recorded_by)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE headcount=VALUES(headcount), wages_paid=VALUES(wages_paid),
       notes=VALUES(notes), recorded_by=VALUES(recorded_by)`,
      [req.params.project_id, engagement_id, register_date, trade,
       parseInt(headcount), wages_paid||null, notes||null, req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'labour.record',
      entityType: 'labour_register', entityId: null,
      details: { project_id: parseInt(req.params.project_id), engagement_id: parseInt(engagement_id), register_date, trade, headcount: parseInt(headcount), wages_paid: wages_paid || null }, req });
    res.json({ success: true });
  }));

// PATCH /api/labour/:project_id/:id/validate — PMC validates site manager entry
router.patch('/:project_id/:id/validate', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { notes } = req.body;
    await db.query(
      'UPDATE labour_register SET validated_by=?, validated_at=NOW(), validation_notes=? WHERE id=? AND project_id=?',
      [req.session.user.id, notes||null, req.params.id, req.params.project_id]
    );
    audit.log({ userId: req.session.user.id, action: 'labour.validate',
      entityType: 'labour_register', entityId: parseInt(req.params.id),
      details: { project_id: parseInt(req.params.project_id), notes: notes || null }, req });
    res.json({ success: true });
  }));

// POST /api/labour/:project_id/validate-all — PMC batch validates all pending entries
router.post('/:project_id/validate-all', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { register_date } = req.body;
    const dateFilter = register_date ? 'AND register_date = ?' : '';
    const params = register_date
      ? [req.session.user.id, req.params.project_id, register_date]
      : [req.session.user.id, req.params.project_id];
    const [result] = await db.query(
      `UPDATE labour_register SET validated_by=?, validated_at=NOW()
       WHERE project_id=? AND validated_by IS NULL ${dateFilter}`,
      params
    );
    audit.log({ userId: req.session.user.id, action: 'labour.validate_all',
      entityType: 'labour_register', entityId: null,
      details: { project_id: parseInt(req.params.project_id), register_date: register_date || null, validated: result.affectedRows }, req });
    res.json({ success: true, validated: result.affectedRows });
  }));

module.exports = router;
