// routes/project-slas.js
//
// Per-project SLA configuration (Sprint 3 Item 12).
//
// SLAs govern when items escalate into the Pending tab (see routes/pending.js).
// Defaults apply when no override exists. Principals (and Design Principal)
// can override them per project from the Project Summary tab.
//
// Endpoints:
//   GET  /api/project-slas/:project_id          — list with defaults merged
//   PUT  /api/project-slas/:project_id/:item    — set sla_days for one item type
//   DELETE /api/project-slas/:project_id/:item  — revert to default
//
// Only principal + design_principal can write. All project roles can read.

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth, requirePrincipal } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit   = require('../../../services/audit');
const router  = express.Router();

// Default SLA thresholds — mirror routes/pending.js (one source of truth lives
// in pending.js; repeat only the defaults here). If pending.js changes these,
// update here too.
const DEFAULTS = {
  grn:        { days: 2, label: 'GRN clearance' },
  drawing:    { days: 3, label: 'Drawing approval' },
  rfi:        { days: 5, label: 'RFI response' },
  clearance:  { days: 7, label: 'Vendor clearance' },
  mom:        { days: 3, label: 'MOM issue to client' },
  pr:         { days: 2, label: 'Payment request review' },
};
const ITEM_TYPES = Object.keys(DEFAULTS);

// ── GET all SLAs for a project, with defaults merged ─────────────────────
router.get('/:project_id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const pid = parseInt(req.params.project_id, 10);
    if (!pid) return res.status(400).json({ error: 'project_id required' });

    const [rows] = await db.query(
      'SELECT item_type, sla_days, updated_at FROM project_slas WHERE project_id = ?',
      [pid]
    );
    const byType = Object.fromEntries(rows.map(r => [r.item_type, r]));

    const items = ITEM_TYPES.map(t => ({
      item_type:  t,
      label:      DEFAULTS[t].label,
      default_days: DEFAULTS[t].days,
      sla_days:   byType[t]?.sla_days ?? DEFAULTS[t].days,
      overridden: !!byType[t],
      updated_at: byType[t]?.updated_at ?? null,
    }));
    res.json({ project_id: pid, items });
  })
);

// ── PUT set SLA days for one item type ────────────────────────────────────
router.put('/:project_id/:item',
  requireAuth,
  requirePrincipal,
  asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = parseInt(req.params.project_id, 10);
    const item = req.params.item;
    if (!pid) return res.status(400).json({ error: 'project_id required' });
    if (!ITEM_TYPES.includes(item)) {
      return res.status(400).json({ error: `Unknown item_type: ${item}`, valid: ITEM_TYPES });
    }
    const days = parseInt(req.body?.sla_days, 10);
    if (!Number.isFinite(days) || days < 1 || days > 60) {
      return res.status(400).json({ error: 'sla_days must be between 1 and 60' });
    }

    // INSERT .. ON DUPLICATE KEY UPDATE — uq_project_item uniqueness ensures
    // one row per (project_id, item_type).
    await db.query(
      `INSERT INTO project_slas (project_id, item_type, sla_days, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         sla_days = VALUES(sla_days),
         updated_by = VALUES(updated_by)`,
      [pid, item, days, me.id]
    );

    audit.log({
      userId: me.id, req,
      action: 'sla_updated',
      details: { project_id: pid, item_type: item, sla_days: days },
    }).catch(() => {});

    res.json({ ok: true, project_id: pid, item_type: item, sla_days: days });
  })
);

// ── DELETE revert to default ──────────────────────────────────────────────
router.delete('/:project_id/:item',
  requireAuth,
  requirePrincipal,
  asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = parseInt(req.params.project_id, 10);
    const item = req.params.item;
    if (!pid) return res.status(400).json({ error: 'project_id required' });
    if (!ITEM_TYPES.includes(item)) {
      return res.status(400).json({ error: `Unknown item_type: ${item}` });
    }
    await db.query(
      'DELETE FROM project_slas WHERE project_id = ? AND item_type = ?',
      [pid, item]
    );
    audit.log({
      userId: me.id, req,
      action: 'sla_reverted',
      details: { project_id: pid, item_type: item },
    }).catch(() => {});
    res.json({ ok: true, project_id: pid, item_type: item, reverted_to_default: true });
  })
);

module.exports = router;
