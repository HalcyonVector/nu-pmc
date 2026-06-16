// routes/pending.js — Pending tab contents (Sprint 2 Item 6).
//
// Serves two sections:
//   🔴 Blocked   — items overdue in someone else's queue (age > project SLA)
//   📋 Needs You — items routed to the viewer for their action
//
// Consumed by the "Pending" tab on the bottom nav for Principal,
// Design Principal, PMC Head, and Audit.
//
// SLAs come from project_slas table (per-project override). Defaults are:
//   grn=2d, drawing=3d, rfi=5d, clearance=7d, mom=3d, pr=2d
// Defined in sla-defaults.js (built here).

const express = require('express');
const db      = require('../../../middleware/db');
const { requireAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const router  = express.Router();

// Default SLA thresholds in days when project_slas has no override.
// Locked in memory #23 of the nav redesign discussion.
const SLA_DEFAULTS = {
  grn: 2, drawing: 3, rfi: 5, clearance: 7, mom: 3, pr: 2,
};

// Fetch all SLA overrides in one query; return a (project_id, item_type) → days map.
// Callers then read `slaFor(slaMap, projectId, itemType)` which falls back
// to SLA_DEFAULTS when no override is set for that pair.
//
// Bug #33 fix: Previously routes/pending.js used SLA_DEFAULTS directly in
// SQL, ignoring any per-project overrides set via the Settings modal.
// Now the SQL filters by min-threshold (default) and post-filters per
// (project_id, item_type) override.
async function loadSLAMap() {
  const [rows] = await db.query('SELECT project_id, item_type, sla_days FROM project_slas');
  const m = new Map();
  for (const r of rows) m.set(`${r.project_id}|${r.item_type}`, parseInt(r.sla_days));
  return m;
}
function slaFor(slaMap, projectId, itemType) {
  const k = `${projectId}|${itemType}`;
  if (slaMap.has(k)) return slaMap.get(k);
  return SLA_DEFAULTS[itemType];
}

// Fetch SLA days for an item_type: try project_slas first, fall back to default.
async function getSLA(projectId, itemType) {
  if (!projectId) return SLA_DEFAULTS[itemType];
  const [[row]] = await db.query(
    'SELECT sla_days FROM project_slas WHERE project_id = ? AND item_type = ?',
    [projectId, itemType]
  );
  return row ? parseInt(row.sla_days) : SLA_DEFAULTS[itemType];
}

// ─── Age helpers ────────────────────────────────────────────────────
// Compute age in full days (floor) between a past DATETIME and now.
// Used for SLA breach detection — age >= sla_days means overdue.
const AGE_DAYS_EXPR = 'TIMESTAMPDIFF(DAY, %s, NOW())';

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.user;
  const role = me.role;

  const blocked = [];
  const needsYou = [];

  // Bug #33 fix: per-project SLA overrides now apply. Load once per request.
  //
  // Approach: the SQL queries use a lower-bound threshold to cheaply filter
  // the pool of candidates, then the `slaFor()` post-filter trims to the
  // actual project-specific threshold.
  //
  // Subtlety: if any project OVERRIDES its SLA to a value SMALLER than the
  // default (e.g. a 5-day default lowered to 2), items in the 2-4 day range
  // must still surface on Pending. So the SQL threshold is
  // `min(default, min-override-for-this-item-type)` — guaranteeing the SQL
  // pool is a superset of any breached item, no matter the override.
  const slaMap = await loadSLAMap();

  // Per-item-type SQL threshold: min(default, any override lower than default).
  const minThresholds = { ...SLA_DEFAULTS };
  for (const [k, days] of slaMap.entries()) {
    const [_pid, itemType] = k.split('|');
    if (minThresholds[itemType] === undefined) continue;
    if (days < minThresholds[itemType]) minThresholds[itemType] = days;
  }

  // ─── BLOCKED (all roles see this set; PMC Head has a narrower custom set) ──
  if (['principal','design_principal','audit'].includes(role)) {
    // Drawings overdue — design-stream L1 (jr_engineer) or L2 (design_head)
    const [dDraws] = await db.query(
      `SELECT dv.id, d.drawing_number, d.drawing_name, d.stream, dv.status,
              dv.created_at, d.project_id,
              TIMESTAMPDIFF(DAY, dv.created_at, NOW()) AS age_days
         FROM drawing_versions dv
         JOIN drawings d ON dv.drawing_id = d.id
        WHERE dv.status IN ('pending_l1','pending_l2')
          AND TIMESTAMPDIFF(DAY, dv.created_at, NOW()) >= ?
        ORDER BY dv.created_at ASC
        LIMIT 50`,
      [minThresholds.drawing]
    );
    const Onboarding = require('../../onboarding/contract');
    const dDrawProjs = await Onboarding.functions.getProjectsByIds(dDraws.map(d => d.project_id));
    dDraws.forEach(d => { d.project_name = dDrawProjs.get(d.project_id)?.name || null; });
    for (const d of dDraws) {
      if (d.age_days < slaFor(slaMap, d.project_id, 'drawing')) continue;
      blocked.push({
        type: 'drawing',
        label: `${d.drawing_number} — ${d.drawing_name}`,
        sub:   `${d.project_name} · ${d.stream} · waiting ${d.age_days}d`,
        age_days: d.age_days,
        project_id: d.project_id,
        tab: 'drawings',
      });
    }

    // RFIs overdue — assigned and not resolved
    const [dRfis] = await db.query(
      `SELECT i.id, i.title, i.issue_type, i.project_id,
              TIMESTAMPDIFF(DAY, i.raised_at, NOW()) AS age_days
         FROM issues i
        WHERE i.issue_type IN ('rfi','design')
          AND i.status IN ('open','in_progress')
          AND TIMESTAMPDIFF(DAY, i.raised_at, NOW()) >= ?
        ORDER BY i.raised_at ASC
        LIMIT 50`,
      [minThresholds.rfi]
    );
    const dRfiProjs = await Onboarding.functions.getProjectsByIds(dRfis.map(i => i.project_id));
    dRfis.forEach(i => { i.project_name = dRfiProjs.get(i.project_id)?.name || null; });
    for (const i of dRfis) {
      if (i.age_days < slaFor(slaMap, i.project_id, 'rfi')) continue;
      blocked.push({
        type: 'rfi',
        label: (i.title || '').substring(0, 60) || `Issue #${i.id}`,
        sub:   `${i.project_name} · ${i.issue_type.toUpperCase()} · waiting ${i.age_days}d`,
        age_days: i.age_days,
        tab: 'issues',
      });
    }

    // GRNs overdue — pending approval
    const [dGrns] = await db.query(
      `SELECT g.id, g.grn_number, g.description, g.project_id,
              TIMESTAMPDIFF(DAY, g.delivery_date, NOW()) AS age_days
         FROM grns g
        WHERE g.status = 'pending'
          AND TIMESTAMPDIFF(DAY, g.delivery_date, NOW()) >= ?
        ORDER BY g.delivery_date ASC
        LIMIT 50`,
      [minThresholds.grn]
    );
    const dGrnProjs = await Onboarding.functions.getProjectsByIds(dGrns.map(g => g.project_id));
    dGrns.forEach(g => { g.project_name = dGrnProjs.get(g.project_id)?.name || null; });
    for (const g of dGrns) {
      if (g.age_days < slaFor(slaMap, g.project_id, 'grn')) continue;
      blocked.push({
        type: 'grn',
        label: `${g.grn_number} — ${(g.description||'').substring(0,50)}`,
        sub:   `${g.project_name} · waiting ${g.age_days}d`,
        age_days: g.age_days,
        tab: 'grn',
      });
    }

    // MOMs not yet approved (status='draft')
    const [dMoms] = await db.query(
      `SELECT m.id, m.title, m.project_id,
              TIMESTAMPDIFF(DAY, m.meeting_date, NOW()) AS age_days
         FROM meetings m
        WHERE m.status = 'draft'
          AND TIMESTAMPDIFF(DAY, m.meeting_date, NOW()) >= ?
        ORDER BY m.meeting_date ASC
        LIMIT 50`,
      [minThresholds.mom]
    );
    const dMomProjs = await Onboarding.functions.getProjectsByIds(dMoms.map(m => m.project_id));
    dMoms.forEach(m => { m.project_name = dMomProjs.get(m.project_id)?.name || null; });
    for (const m of dMoms) {
      if (m.age_days < slaFor(slaMap, m.project_id, 'mom')) continue;
      blocked.push({
        type: 'mom',
        label: (m.title || `Meeting #${m.id}`).substring(0, 60),
        sub:   `${m.project_name} · MOM draft · ${m.age_days}d`,
        age_days: m.age_days,
        tab: 'meetings',
      });
    }

    // Vendor clearance overdue — pending.
    // NOTE: vendors are firm-wide (not tied to a single project), so the
    // per-project SLA override system doesn't apply. Always uses the default.
    const [dVendors] = await db.query(
      `SELECT v.id, v.vendor_name,
              TIMESTAMPDIFF(DAY, v.created_at, NOW()) AS age_days
         FROM vendors v
        WHERE v.clearance_status = 'pending'
          AND TIMESTAMPDIFF(DAY, v.created_at, NOW()) >= ?
        ORDER BY v.created_at ASC
        LIMIT 50`,
      [minThresholds.clearance]
    );
    for (const v of dVendors) {
      blocked.push({
        type: 'vendor_clearance',
        label: v.vendor_name || `Vendor #${v.id}`,
        sub:   `Awaiting finance clearance · ${v.age_days}d`,
        age_days: v.age_days,
        tab: 'vendors_master',
      });
    }
  }

  // ─── BLOCKED — PMC Head view (things stuck with site team) ─────────
  else if (role === 'pmc_head') {
    const Onboarding = require('../../onboarding/contract');
    // Site reports flagged but not resolved
    const [flagged] = await db.query(
      `SELECT dr.id, dr.project_id,
              dr.ai_flag_reason,
              TIMESTAMPDIFF(DAY, dr.submitted_at, NOW()) AS age_days
         FROM daily_reports dr
        WHERE dr.status = 'flagged'
          AND TIMESTAMPDIFF(DAY, dr.submitted_at, NOW()) >= 1
        ORDER BY dr.submitted_at ASC
        LIMIT 30`
    );
    const flagProjs = await Onboarding.functions.getProjectsByIds(flagged.map(r => r.project_id));
    flagged.forEach(r => { r.project_name = flagProjs.get(r.project_id)?.name || null; });
    for (const r of flagged) {
      blocked.push({
        type: 'report_flagged',
        label: `Daily report flagged — ${r.project_name}`,
        sub:   `${(r.ai_flag_reason||'').substring(0,60)} · ${r.age_days}d`,
        age_days: r.age_days,
        tab: 'reports',
      });
    }

    // Site issues with no update — use raised_at (updated_at not present in issues table)
    const [siteIssues] = await db.query(
      `SELECT i.id, i.title, i.project_id,
              TIMESTAMPDIFF(DAY, i.raised_at, NOW()) AS age_days
         FROM issues i
        WHERE i.issue_type IN ('safety','quality')
          AND i.status IN ('open','in_progress')
          AND TIMESTAMPDIFF(DAY, i.raised_at, NOW()) >= ?
        ORDER BY i.raised_at ASC
        LIMIT 30`,
      [minThresholds.rfi]
    );
    const siProjs = await Onboarding.functions.getProjectsByIds(siteIssues.map(i => i.project_id));
    siteIssues.forEach(i => { i.project_name = siProjs.get(i.project_id)?.name || null; });
    for (const i of siteIssues) {
      if (i.age_days < slaFor(slaMap, i.project_id, 'rfi')) continue;
      blocked.push({
        type: 'site_issue',
        label: (i.title || '').substring(0, 60) || `Issue #${i.id}`,
        sub:   `${i.project_name} · no update ${i.age_days}d`,
        age_days: i.age_days,
        tab: 'issues',
      });
    }
  }

  // ─── NEEDS YOU (Principal / Design Principal / Audit) ──────────────
  if (['principal','design_principal','audit'].includes(role)) {
    // PRs awaiting principal review
    const [prs] = await db.query(
      `SELECT pr.id, pr.amount_requested, pr.vendor_id, pr.project_id,
              TIMESTAMPDIFF(DAY, pr.pmc_reviewed_at, NOW()) AS age_days
         FROM payment_requests pr
        WHERE pr.status = 'pending_principal'
        ORDER BY pr.pmc_reviewed_at ASC
        LIMIT 50`
    );
    const Onboarding = require('../../onboarding/contract');
    const prVendors = await Onboarding.functions.getVendorsByIds(prs.map(pr => pr.vendor_id));
    const prProjs   = await Onboarding.functions.getProjectsByIds(prs.map(pr => pr.project_id));
    prs.forEach(pr => {
      pr.vendor_name  = prVendors.get(pr.vendor_id)?.vendor_name || null;
      pr.project_name = prProjs.get(pr.project_id)?.name || null;
    });
    for (const pr of prs) {
      needsYou.push({
        type: 'payment',
        label: `${pr.vendor_name || 'Vendor'} — ₹${Number(pr.amount_requested).toLocaleString('en-IN')}`,
        sub:   `${pr.project_name} · pending your review`,
        age_days: pr.age_days,
        tab: 'payments',
      });
    }

    // Change notices awaiting principal approval.
    // schema: status='pending_approval' is the state routed for final approval
    // after all signatures are collected. Cost filter (e.g. ₹1L threshold) would
    // require joining change_notice_items — deferred. For now all pending
    // approvals surface, principals can visually scan by title.
    const [cns] = await db.query(
      `SELECT c.id, c.cn_number, c.title, c.schedule_impact_days, c.project_id,
              TIMESTAMPDIFF(DAY, c.raised_at, NOW()) AS age_days
         FROM change_notices c
        WHERE c.status = 'pending_approval'
        ORDER BY c.raised_at ASC
        LIMIT 30`
    );
    const cnProjs = await Onboarding.functions.getProjectsByIds(cns.map(c => c.project_id));
    cns.forEach(c => { c.project_name = cnProjs.get(c.project_id)?.name || null; });
    for (const c of cns) {
      const scheduleNote = c.schedule_impact_days
        ? `${c.schedule_impact_days}d schedule impact · `
        : '';
      needsYou.push({
        type: 'cn',
        label: `${c.cn_number} — ${(c.title || '').substring(0,60)}`,
        sub:   `${c.project_name} · ${scheduleNote}${c.age_days}d pending`,
        age_days: c.age_days,
        tab: 'changes',
      });
    }
  }

  // Sort both lists: oldest first (highest age_days)
  blocked.sort((a, b) => (b.age_days || 0) - (a.age_days || 0));
  needsYou.sort((a, b) => (b.age_days || 0) - (a.age_days || 0));

  res.json({
    role,
    blocked,
    needsYou,
    blocked_count: blocked.length,
    needs_you_count: needsYou.length,
  });
}));

module.exports = router;
