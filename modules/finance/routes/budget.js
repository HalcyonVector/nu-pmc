// routes/budget.js — Budget cost heads, actuals, variance reporting
const express    = require('express');
const db         = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth, requireRole, requirePrincipal, requirePMC, requireProjectScope } = require('../../../middleware/auth');
const { checkBudget, persistAndNotify, STREAM_MAP } = require('../../../services/budget-check');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { PRINCIPALS } = require('../../../services/roles');
const notif     = require('../../../services/notifications');
const router     = express.Router();


// ── GET /api/budget/:project_id — full budget vs actual summary
router.get('/:project_id', requireAuth, asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;

    // Role-based visibility
    const canSeeFull = [...PRINCIPALS,'pmc_head','finance_admin'].includes(me.role);
    const isDesignHead   = me.role === 'design_head';
    const isServicesHead = me.role === 'services_head';
    const isAudit        = me.role === 'audit';

    if (!canSeeFull && !isDesignHead && !isServicesHead && !isAudit) {
      return res.status(403).json({ error: 'Budget visibility: PMC, principals, design heads only' });
    }

    let streamFilter = '';
    if (isDesignHead)   streamFilter = "AND bch.stream IN ('design','common')";
    if (isServicesHead) streamFilter = "AND bch.stream IN ('services','common')";

    // Cost heads with committed amounts
    const [heads] = await db.query(
      `SELECT bch.*,
              COALESCE(
                (SELECT SUM(vbi.our_cost_total)
                 FROM vendor_boq_items vbi
                 JOIN boq_items bi ON vbi.boq_item_id = bi.id
                 WHERE bi.project_id = bch.project_id AND bi.trade = bch.code),0
              ) AS committed,
              COALESCE(
                (SELECT SUM(vp.recommended_amount)
                 FROM vendor_payments vp
                 JOIN vendor_engagements ve ON vp.engagement_id = ve.id
                 WHERE ve.project_id = bch.project_id
                 AND vp.status IN ('paid','approved')
                 AND EXISTS (SELECT 1 FROM vendor_boq_items vbi2
                             JOIN boq_items bi2 ON vbi2.boq_item_id = bi2.id
                             WHERE vbi2.engagement_id = ve.id AND bi2.trade = bch.code)),0
              ) AS paid
       FROM budget_cost_heads bch
       WHERE bch.project_id = ? AND bch.status = 'approved' ${streamFilter}
       ORDER BY bch.display_order, bch.code`,
      [pid]
    );
    const Auth = require('../../auth/contract');
    const headUsers = await Auth.functions.getUsers(heads.map(h => h.created_by).filter(Boolean));
    heads.forEach(h => { h.created_by_name = headUsers.get(h.created_by)?.full_name || null; });

    // Recent flags
    const [flags] = await db.query(
      `SELECT bf.*, bch.code AS trade, bch.name AS head_name,
              bi.item_name
       FROM budget_flags bf
       JOIN budget_cost_heads bch ON bf.cost_head_id = bch.id
       LEFT JOIN boq_items bi ON bf.boq_item_id = bi.id
       WHERE bf.project_id = ? ORDER BY bf.created_at DESC LIMIT 20`,
      [pid]
    );
    const flagUsers = await Auth.functions.getUsers(flags.map(f => f.signoff_by).filter(Boolean));
    flags.forEach(f => { f.signoff_by_name = flagUsers.get(f.signoff_by)?.full_name || null; });

    // Project totals
    const totalSanctioned = heads.reduce((a,h) => a + parseFloat(h.sanctioned||0), 0);
    const totalCommitted  = heads.reduce((a,h) => a + parseFloat(h.committed||0), 0);
    const totalPaid       = heads.reduce((a,h) => a + parseFloat(h.paid||0), 0);
    const projectPctOver  = totalSanctioned > 0
      ? ((totalCommitted - totalSanctioned) / totalSanctioned * 100).toFixed(2)
      : '0.00';

    res.json({
      cost_heads: heads.map(h => ({
        ...h,
        pct_committed: h.sanctioned > 0
          ? ((h.committed / h.sanctioned) * 100).toFixed(1) : '0.0',
        variance:    (parseFloat(h.committed) - parseFloat(h.sanctioned)).toFixed(2),
        variance_pct: h.sanctioned > 0
          ? (((h.committed - h.sanctioned) / h.sanctioned) * 100).toFixed(1) : '0.0',
        status: parseFloat(h.committed) > parseFloat(h.sanctioned) * 1.15 ? 'critical'
              : parseFloat(h.committed) > parseFloat(h.sanctioned) * 1.10 ? 'over'
              : parseFloat(h.committed) > parseFloat(h.sanctioned) * 1.05 ? 'watch'
              : 'ok',
      })),
      totals: { sanctioned: totalSanctioned, committed: totalCommitted,
                paid: totalPaid, pct_over: projectPctOver },
      recent_flags: flags,
    });
  }));

// ── POST /api/budget/:project_id/initialise — auto-derive cost heads from BOQ
router.post('/:project_id/initialise', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const pid = req.params.project_id;

    // Get distinct trades from BOQ
    const [trades] = await db.query(
      `SELECT DISTINCT bi.trade,
              SUM(vbi.our_cost_total) AS sanctioned
       FROM boq_items bi
       JOIN vendor_boq_items vbi ON vbi.boq_item_id = bi.id
       WHERE bi.project_id = ?
       GROUP BY bi.trade`,
      [pid]
    );

    if (!trades.length) {
      return res.status(400).json({ error: 'No BOQ found for this project — upload BOQ first' });
    }

    let created = 0, skipped = 0;
    for (const [idx, t] of trades.entries()) {
      const stream = STREAM_MAP[t.trade] || 'common';
      try {
        await db.query(
          `INSERT INTO budget_cost_heads
           (project_id, code, name, stream, sanctioned, display_order, created_by)
           VALUES (?,?,?,?,?,?,?)`,
          [pid, t.trade, t.trade, stream, parseFloat(t.sanctioned||0),
           idx + 1, req.session.user.id]
        );
        created++;
      } catch (e) {
        // Idempotent by design — cost head for this trade already exists
        if (e.code === 'ER_DUP_ENTRY') {
          skipped++;
          continue;
        }
        throw e;  // Surface other errors (rule #21 lesson 2 — fail loud)
      }
    }

    audit.log({ userId: req.session.user.id, action: 'budget.initialise',
      entityType: 'budget_cost_heads', entityId: null,
      details: { project_id: parseInt(pid, 10), created, skipped, trades: trades.map(t => t.trade) }, req });

    res.json({ success: true, created, skipped,
      message: `${created} cost heads initialised from BOQ${skipped ? `, ${skipped} already existed` : ''}. Sanctioned amounts auto-set.` });
  }));

// ── POST /api/budget/:project_id/custom-head — add custom cost head
router.post('/:project_id/custom-head', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const me = req.session.user;
    const { BudgetCustomHead, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(BudgetCustomHead, req, res);
    if (!body) return;

    const { fmtRupee } = require('../../../services/payment-validation');

    // Project-level budget ceiling — cumulative heads must not exceed project budget
    const Onboarding = require('../../onboarding/contract');
    const project = await Onboarding.functions.getProject(req.params.project_id);
    if (project?.total_budget) {
      const [[sums]] = await db.query(
        `SELECT COALESCE(SUM(sanctioned),0) AS total_sanctioned
         FROM budget_cost_heads WHERE project_id = ? AND status = 'approved'`,
        [req.params.project_id]
      );
      const existing = parseFloat(sums.total_sanctioned || 0);
      const total    = existing + body.sanctioned;
      const ceiling  = parseFloat(project.total_budget);
      if (total > ceiling) {
        return res.status(400).json({
          error: `Total heads (${fmtRupee(total)}) would exceed project budget ceiling of ${fmtRupee(ceiling)}. ` +
                 `Already sanctioned: ${fmtRupee(existing)}. Maximum you can add: ${fmtRupee(Math.max(0, ceiling - existing))}.`
        });
      }
    }

    // Custom heads need stream head approval (stream-aware) or principal
    const isPrincipal = PRINCIPALS.includes(me.role);
    const status      = isPrincipal ? 'approved' : 'pending';

    const [result] = await db.query(
      `INSERT INTO budget_cost_heads
       (project_id, code, name, stream, sanctioned, is_custom, status,
        approved_by, approved_at, created_by)
       VALUES (?,?,?,?,?,1,?,?,?,?)`,
      [req.params.project_id, body.code.toUpperCase(), body.name,
       body.stream || 'common', body.sanctioned,
       status,
       isPrincipal ? me.id : null,
       isPrincipal ? new Date() : null,
       me.id]
    );

    if (!isPrincipal) {
      // Notify appropriate stream head for approval
      const headRole = body.stream === 'design'   ? 'design_head'
                     : body.stream === 'services' ? 'services_head'
                     : null;

      if (headRole) {
        const Auth = require('../../auth/contract');
        const heads = await Auth.functions.getUsersByRole(headRole, req.params.project_id);
        for (const h of heads) {
          await notif.notify(h.id, 'budget_custom_head',
             `Custom budget head requested: ${body.name} (${body.code}) — ₹${body.sanctioned.toLocaleString('en-IN')}. Your approval needed.`);
        }
      } else {
        // Common stream — notify Principal
        const principals = await users.principals();
        for (const p of principals) {
          await notif.notify(p.id, 'budget_custom_head',
             `Custom budget head requested: ${body.name} (${body.code}) — ₹${body.sanctioned.toLocaleString('en-IN')}. Your approval needed.`);
        }
      }
    }

    audit.log({ userId: me.id, action: 'budget.custom_head_create',
      entityType: 'budget_cost_heads', entityId: result.insertId,
      details: { project_id: parseInt(req.params.project_id, 10), code: body.code.toUpperCase(), name: body.name, stream: body.stream || 'common', sanctioned: body.sanctioned, status }, req });

    res.json({
      success: true, id: result.insertId, status,
      message: isPrincipal
        ? `Custom head ${body.code} added and approved.`
        : `Custom head ${body.code} pending ${body.stream || 'common'} head approval.`,
    });
  }));

// ── PATCH /api/budget/cost-heads/:id/approve — stream head approves custom head
router.patch('/cost-heads/:id/approve', requireAuth,
  requireRole(...PRINCIPALS, 'design_head', 'services_head'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const [[cur]] = await db.query('SELECT status FROM budget_cost_heads WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Cost head not found' });
    if (cur.status === 'approved') return res.json({ success: true });   // idempotent

    const sm = require('../../../services/state-machines').budgetCostHead;
    try {
      await sm.transition({
        id: parseInt(req.params.id, 10), from: cur.status, to: 'approved',
        extraCols: { approved_by: me.id, approved_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    audit.log({ userId: me.id, action: 'budget.custom_head_approve',
      entityType: 'budget_cost_heads', entityId: parseInt(req.params.id, 10),
      details: { approver_role: me.role }, req });

    // Notify finance_admin — they're the ones who'll book costs against this
    // new head and need it to appear in their working set. The principal
    // approving doesn't need to be told they approved (Decision Event 10,
    // May 2026 — was: notify all principals).
    const financeAdmins = await users.usersByRole('finance_admin', 'id');
    for (const f of financeAdmins) {
      await notif.notify(f.id, 'budget_custom_head', `Custom budget head approved by ${me.full_name} — now available in budget tracking.`);
    }
    res.json({ success: true });
  }));

// ── PATCH /api/budget/flags/:id/signoff — PMC or stream head signs off on flag
router.patch('/flags/:id/signoff', requireAuth,
  requireRole(...PRINCIPALS, 'pmc_head', 'design_head', 'services_head'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const { note } = req.body;
    await db.query(
      'UPDATE budget_flags SET signoff_by=?, signoff_at=NOW(), signoff_note=? WHERE id=?',
      [me.id, note || null, req.params.id]
    );
    audit.log({ userId: me.id, action: 'budget.flag_signoff',
      entityType: 'budget_flags', entityId: parseInt(req.params.id, 10),
      details: { note: note || null, signer_role: me.role }, req });
    res.json({ success: true });
  }));

// ── GET /api/budget/:project_id/digest — daily digest data for PMC and heads
router.get('/:project_id/digest', requireAuth,
  requireRole(...PRINCIPALS, 'pmc_head', 'finance_admin', 'design_head', 'services_head'),
  asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const isDesignHead   = me.role === 'design_head';
    const isServicesHead = me.role === 'services_head';

    let streamFilter = '';
    if (isDesignHead)   streamFilter = "AND bch.stream IN ('design','common')";
    if (isServicesHead) streamFilter = "AND bch.stream IN ('services','common')";

    const [overBudget] = await db.query(
      `SELECT bch.code, bch.name, bch.sanctioned, bch.stream,
              COALESCE(
                (SELECT SUM(vbi.our_cost_total)
                 FROM vendor_boq_items vbi
                 JOIN boq_items bi ON vbi.boq_item_id = bi.id
                 WHERE bi.project_id = bch.project_id AND bi.trade = bch.code),0
              ) AS committed
       FROM budget_cost_heads bch
       WHERE bch.project_id = ? AND bch.status='approved' ${streamFilter}
       HAVING committed > sanctioned * 1.05
       ORDER BY (committed - sanctioned) DESC`,
      [pid]
    );

    res.json({
      over_budget_heads: overBudget,
      has_alerts: overBudget.length > 0,
    });
  }));

// GET /api/budget/:project_id/tree — hierarchical BOQ budget view
router.get('/:project_id/tree', requireAuth,
  requireRole(...PRINCIPALS, 'pmc_head', 'finance_admin', 'design_head', 'services_head'),
  asyncHandler(async (req, res) => {
    const pid = req.params.project_id;
    const me  = req.session.user;

    // Role-based stream filter
    const isDesign   = me.role === 'design_head';
    const isServices = me.role === 'services_head';

    let streamFilter = '';
    if (isDesign)   streamFilter = "AND bch.stream IN ('design','common')";
    if (isServices) streamFilter = "AND bch.stream IN ('services','common')";

    // Single-query approach — fetch everything at once and group in JS
    const [heads] = await db.query(
      `SELECT bch.code AS trade, bch.name, bch.sanctioned, bch.stream, bch.display_order
       FROM budget_cost_heads bch
       WHERE bch.project_id=? AND bch.status='approved' ${streamFilter}
       ORDER BY bch.display_order, bch.code`,
      [pid]
    );

    // Fetch all BOQ items + their committed amounts in one query
    const [allItems] = await db.query(
      `SELECT bi.id, bi.trade, bi.parent_id, bi.item_name, bi.item_code,
              bi.unit, bi.quantity, bi.is_section, bi.display_order,
              COALESCE(SUM(vbi.our_cost_total), 0) AS committed
       FROM boq_items bi
       JOIN boq_versions bv ON bi.boq_version_id=bv.id
       LEFT JOIN vendor_boq_items vbi ON vbi.boq_item_id=bi.id
       WHERE bi.project_id=? AND bv.is_current=1
       GROUP BY bi.id
       ORDER BY bi.trade, bi.display_order`,
      [pid]
    );

    // Group items in JavaScript
    const sectionsByTrade = {};
    const childrenByParent = {};
    const orphansByTrade  = {};

    for (const item of allItems) {
      if (item.is_section) {
        if (!sectionsByTrade[item.trade]) sectionsByTrade[item.trade] = [];
        sectionsByTrade[item.trade].push(item);
      } else if (item.parent_id) {
        if (!childrenByParent[item.parent_id]) childrenByParent[item.parent_id] = [];
        childrenByParent[item.parent_id].push(item);
      } else {
        // Orphan items with no parent section
        if (!orphansByTrade[item.trade]) orphansByTrade[item.trade] = [];
        orphansByTrade[item.trade].push(item);
      }
    }

    // Build tree
    const tree = heads.map(head => {
      // Committed = sum of all items in trade
      const tradeCommitted = allItems
        .filter(i => i.trade === head.trade && !i.is_section)
        .reduce((s, i) => s + parseFloat(i.committed||0), 0);

      const variance = tradeCommitted - parseFloat(head.sanctioned);
      const pct = head.sanctioned > 0 ? (variance / head.sanctioned * 100).toFixed(1) : '0.0';

      // Sections with their children
      const sections = (sectionsByTrade[head.trade] || []).map(sec => {
        const children = (childrenByParent[sec.id] || []).map(ch => ({
          ...ch,
          committed: parseFloat(ch.committed||0),
          variance: '0',
        }));
        const section_committed = children.reduce((s, c) => s + c.committed, 0);
        return { ...sec, section_committed, children };
      });

      // Orphan items for this trade (no section parent)
      const orphans = (orphansByTrade[head.trade] || []).map(ch => ({
        ...ch, committed: parseFloat(ch.committed||0), variance: '0',
      }));
      if (orphans.length) {
        sections.unshift({
          id: null, item_name: 'Uncategorised', item_code: null,
          section_committed: orphans.reduce((s, c) => s + c.committed, 0),
          children: orphans,
        });
      }

      return {
        trade: head.trade, name: head.name, stream: head.stream,
        sanctioned: parseFloat(head.sanctioned),
        committed:  +tradeCommitted.toFixed(2),
        variance:   +variance.toFixed(2),
        variance_pct: pct,
        status: parseFloat(pct) >= 15 ? 'critical' : parseFloat(pct) >= 10 ? 'over' : parseFloat(pct) >= 5 ? 'watch' : 'ok',
        sections,
      };
    });

    res.json({ tree, project_id: pid });
  }));

module.exports = router;
