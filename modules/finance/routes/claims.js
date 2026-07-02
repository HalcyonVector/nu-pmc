// routes/claims.js — Client Claims module
const express = require('express');
const db      = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { validators } = require('../../../middleware/validate');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const {
  CLAIM_REVIEWERS: CLAIM_ROLES,
  PMC_PRINCIPAL,
  STREAM_HEADS_OR_PRINCIPAL: STREAM_HEADS,
} = require('../../../services/roles');
const router  = express.Router();

// GET /api/claims/:project_id — list all claims
router.get('/:project_id', requireAuth, requireRole(...CLAIM_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [claims] = await db.query(
      `SELECT * FROM client_claims
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      claims.flatMap(c => [c.raised_by, c.pmc_signoff, c.rs_signoff, c.approved_by].filter(Boolean))
    );
    claims.forEach(c => {
      c.raised_by_name    = users.get(c.raised_by)?.full_name    || null;
      c.pmc_signoff_name  = users.get(c.pmc_signoff)?.full_name  || null;
      c.rs_signoff_name   = users.get(c.rs_signoff)?.full_name   || null;
      c.approved_by_name  = users.get(c.approved_by)?.full_name  || null;
    });

    // Running totals per claim
    for (const claim of claims) {
      const [[totals]] = await db.query(
        `SELECT
           SUM(cli.claimed_qty * cb.client_rate) AS claim_amount,
           COUNT(cli.id) AS item_count
         FROM claim_items cli
         JOIN client_boq_items cb ON cli.client_boq_item_id = cb.id
         WHERE cli.claim_id = ?`,
        [claim.id]
      );
      claim.claim_amount = totals?.claim_amount || 0;
      claim.item_count   = totals?.item_count   || 0;
    }

    // Total claimed to date for project
    const [[projectTotal]] = await db.query(
      `SELECT SUM(cli.claimed_qty * cb.client_rate) AS total_claimed
       FROM claim_items cli
       JOIN client_boq_items cb ON cli.client_boq_item_id = cb.id
       JOIN client_claims cl ON cli.claim_id = cl.id
       WHERE cl.project_id = ? AND cl.status IN ('approved','invoiced')`,
      [req.params.project_id]
    );

    res.json({
      claims,
      total_claimed_to_date: projectTotal?.total_claimed || 0
    });

  }));

// GET /api/claims/:project_id/:claim_id/items — claim line items
router.get('/:project_id/:claim_id/items', requireAuth, requireRole(...CLAIM_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
        const [items] = await db.query(
      `SELECT cli.*, cb.item_name, cb.item_code, cb.unit, cb.trade,
         cb.quantity AS boq_qty, cb.client_rate,
         (cli.claimed_qty * cb.client_rate) AS line_amount,
         -- Previously claimed for this item
         (SELECT COALESCE(SUM(cli2.claimed_qty),0)
          FROM claim_items cli2
          JOIN client_claims cl2 ON cli2.claim_id = cl2.id
          WHERE cli2.client_boq_item_id = cb.id
            AND cl2.project_id = ?
            AND cl2.status IN ('approved','invoiced')
            AND cl2.id != ?) AS previously_claimed
       FROM claim_items cli
       JOIN client_boq_items cb ON cli.client_boq_item_id = cb.id
       WHERE cli.claim_id = ?
       ORDER BY cb.trade, cb.display_order`,
      [req.params.project_id, req.params.claim_id, req.params.claim_id]
    );

    res.json({ items });
  }));

// POST /api/claims/:project_id — raise new claim
router.post('/:project_id', requireAuth, requireProjectScope(), requireRole(...PMC_PRINCIPAL), asyncHandler(async (req, res) => {
    const me  = req.session.user;
    const pid = req.params.project_id;
    const { ClaimCreate, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(ClaimCreate, req, res);
    if (!body) return;

    // Measurement must be client_accepted before claim can be raised
    if (body.measurement_id) {
      const [[meas]] = await db.query(
        'SELECT status FROM measurements WHERE id = ? AND project_id = ?',
        [body.measurement_id, pid]
      );
      if (!meas) return res.status(404).json({ error: 'Measurement not found' });
      if (meas.status !== 'client_accepted') {
        return res.status(400).json({ error: 'Client acceptance required before raising claim' });
      }
    }

    const [result] = await db.query(
      `INSERT INTO client_claims
         (project_id, ra_bill_number, discipline, measurement_id, notes, raised_by, status)
       VALUES (?,?,?,?,?,?,?)`,
      [pid, body.ra_bill_number, body.discipline, body.measurement_id, body.notes, me.id, 'draft']
    );

    audit.log({ userId: me.id, action: 'claim.raise',
      entityType: 'client_claims', entityId: result.insertId,
      details: { project_id: parseInt(pid, 10), ra_bill_number: body.ra_bill_number, discipline: body.discipline, measurement_id: body.measurement_id || null }, req });

    // A newly-raised claim needs PMC + R/S sign-off before Principal approval.
    // Notify the PMC heads so the sign-off chain starts. Fire-and-forget after
    // the insert committed; 'claim_raised' is allowlisted in the d11 test.
    (async () => {
      const projName = await users.projectName(pid);
      const msg = `nu PMC: Client claim raised — RA Bill ${body.ra_bill_number} (${body.discipline}) `
        + `on ${projName || ('project ' + pid)}. Sign-off needed.`;
      const pmcUsers = await users.pmcHeads();
      const { notify } = require('../../../services/notifications');
      for (const u of pmcUsers) await notify(u.id, 'claim_raised', msg);
    })().catch(_e => { /* notification failure — non-blocking */ });

    res.json({ success: true, id: result.insertId });
  }));

// POST /api/claims/:project_id/:claim_id/items — add claimed quantities
router.post('/:project_id/:claim_id/items', requireAuth, requireProjectScope(), requireRole(...CLAIM_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
        const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Items required' });

    for (const item of items) {
      await db.query(
        `INSERT INTO claim_items (claim_id, client_boq_item_id, claimed_qty)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE claimed_qty = VALUES(claimed_qty)`,
        [req.params.claim_id, item.client_boq_item_id, item.claimed_qty]
      );
    }

    audit.log({ userId: me.id, action: 'claim.items_save',
      entityType: 'client_claims', entityId: parseInt(req.params.claim_id, 10),
      details: { project_id: parseInt(req.params.project_id, 10), items_saved: items.length }, req });

    res.json({ success: true, items_saved: items.length });
  }));

// Helper: record a signoff on a claim. Both the PMC side and the R/S side use this.
// `side` is whitelisted ('pmc' | 'rs') — NOT interpolated from user input.
// Column names derived via explicit branch, not string-concatenated from `side`.
async function recordClaimSignoff(side, claimId, projectId, actorId) {
  if (side !== 'pmc' && side !== 'rs') throw new Error('Invalid signoff side: ' + side);

  const col   = side === 'pmc' ? 'pmc_signoff'    : 'rs_signoff';
  const colAt = side === 'pmc' ? 'pmc_signoff_at' : 'rs_signoff_at';
  const other = side === 'pmc' ? 'rs_signoff'     : 'pmc_signoff';
  const label = side === 'pmc' ? 'PMC' : 'R/S';

  // Two-step: (1) update the signoff columns; (2) if the OTHER signoff is now
  // present too, transition status to pending_approval via the state machine.
  // Pre-v5.22 this was one CASE-based UPDATE — kept as one statement for atomicity
  // but bypassed the state machine. The SM transition is now distinct so the
  // status guard (only fires from 'draft' to 'pending_approval') applies.
  await db.query(
    `UPDATE client_claims SET ${col} = ?, ${colAt} = NOW()
     WHERE id = ? AND project_id = ?`,
    [actorId, claimId, projectId]
  );
  // Re-read to see whether both signoffs are now present
  const [[ck]] = await db.query(
    `SELECT status, ${other} AS other_signoff FROM client_claims WHERE id = ? AND project_id = ?`,
    [claimId, projectId]
  );
  if (ck && ck.other_signoff !== null && ck.status === 'draft') {
    const sm = require('../../../services/state-machines').clientClaim;
    await sm.transition({
      id: claimId, from: 'draft', to: 'pending_approval',
    });
  }

  // If both sign-offs now present, surface on central Approvals dashboard
  const [[c]] = await db.query(
    'SELECT id, project_id, ra_bill_number, status FROM client_claims WHERE id = ?',
    [claimId]
  );
  // approvals.register() removed — claim surfacing via wa_pending_actions is retired.
  // Principal approves claims via POST /api/claims/:project_id/:claim_id/approve.

  return `${label} sign-off recorded`;
}

// POST /api/claims/:project_id/:claim_id/pmc-signoff — M/P signs off
router.post('/:project_id/:claim_id/pmc-signoff', requireAuth, requireProjectScope(), requireRole(...PMC_PRINCIPAL), asyncHandler(async (req, res) => {
  const message = await recordClaimSignoff('pmc', req.params.claim_id, req.params.project_id, req.session.user.id);
  res.json({ success: true, message });
}));

// POST /api/claims/:project_id/:claim_id/rs-signoff — R/S signs off
router.post('/:project_id/:claim_id/rs-signoff', requireAuth, requireProjectScope(), requireRole(...STREAM_HEADS), asyncHandler(async (req, res) => {
  const message = await recordClaimSignoff('rs', req.params.claim_id, req.params.project_id, req.session.user.id);
  res.json({ success: true, message });
}));

// POST /api/claims/:project_id/:claim_id/approve — Principal ONLY
router.post('/:project_id/:claim_id/approve', requireAuth, requireProjectScope(), requireRole('principal','design_principal'), asyncHandler(async (req, res) => {
    const [[claim]] = await db.query(
      'SELECT * FROM client_claims WHERE id = ? AND project_id = ?',
      [req.params.claim_id, req.params.project_id]
    );
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (!claim.pmc_signoff || !claim.rs_signoff) {
      return res.status(400).json({ error: 'Both M/P and R/S sign-offs required before approval' });
    }

    const sm = require('../../../services/state-machines').clientClaim;
    try {
      await sm.transition({
        id: parseInt(req.params.claim_id, 10), from: claim.status, to: 'approved',
        extraCols: { approved_by: req.session.user.id, approved_at: new Date() },
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    audit.log({ userId: req.session.user.id, action: 'claim.approve',
      entityType: 'client_claims', entityId: parseInt(req.params.claim_id, 10),
      details: { project_id: parseInt(req.params.project_id, 10), ra_bill_number: claim.ra_bill_number }, req });

    // approvals.close() removed — wa_pending_actions is retired.

    // Notify Finance Admin via WhatsApp with rates and amounts
    try {
      // Get claim items with rates for Finance Admin
      const [items] = await db.query(
        `SELECT cb.item_code, cb.item_name, cb.unit, cli.claimed_qty, cb.client_rate,
           (cli.claimed_qty * cb.client_rate) AS line_amount, cb.trade
         FROM claim_items cli
         JOIN client_boq_items cb ON cli.client_boq_item_id = cb.id
         WHERE cli.claim_id = ?`,
        [req.params.claim_id]
      );

      const proj = { name: await users.projectName(req.params.project_id) };
      const total    = items.reduce((s, i) => s + parseFloat(i.line_amount || 0), 0);
      const totalFmt = total.toLocaleString('en-IN');

      // Build message for Finance Admin
      const msg = `nu PMC — Client Claim Approved\n` +
        `Project: ${proj?.name}\n` +
        `RA Bill: ${claim.ra_bill_number} — ${claim.discipline}\n` +
        `Total: ₹${totalFmt}\n\n` +
        `Please generate GST invoice.\n` +
        `Full breakdown attached.`;

      // Notify finance admins (role-based — was hardcoded username='finance_admin')
      const { notify } = require('../../../services/notifications');
      const financeRecipients = await users.financeAdmins('id');
      for (const fa of financeRecipients) {
        await notify(fa.id, 'claim_approved', msg);
      }

      // Also notify M/P
      const pmcUsers = await users.pmcHeads();
      for (const u of pmcUsers) {
        await notify(u.id, 'claim_approved',
          `Claim approved — ${proj?.name} RA Bill ${claim.ra_bill_number}. Total: ₹${totalFmt}. Finance notified.`);
      }
    } catch(_e) { /* notification failure — non-blocking */ }

    res.json({ success: true, message: 'Claim approved — finance notified via WhatsApp' });
  }));

// PATCH /api/claims/:project_id/:claim_id/invoice-number — M/P records Finance Admin's invoice number
router.patch('/:project_id/:claim_id/invoice-number', requireAuth, requireProjectScope(), requireRole(...PMC_PRINCIPAL), validators.invoiceNumber, asyncHandler(async (req, res) => {
    const me = req.session.user;
        const { invoice_number, invoice_date } = req.body;

    // State-machine guard: only 'approved' claims can be invoiced.
    // Prevents draft/pending_approval claims from jumping straight to invoiced.
    const [rows] = await db.query(
      `SELECT status FROM client_claims WHERE id = ? AND project_id = ?`,
      [req.params.claim_id, req.params.project_id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    if (rows[0].status !== 'approved') {
      return res.status(409).json({
        error: `Cannot invoice a claim in status '${rows[0].status}' — must be 'approved' first`,
        code: 'INVALID_STATE_TRANSITION',
      });
    }

    const sm = require('../../../services/state-machines').clientClaim;
    try {
      await sm.transition({
        id: parseInt(req.params.claim_id, 10), from: 'approved', to: 'invoiced',
        extraCols: {
          invoice_number, invoice_date: invoice_date || null,
          invoiced_by: me.id, invoiced_at: new Date(),
        },
      });
    } catch (err) { return sm.handleRouteError(err, res); }

    audit.log({ userId: me.id, action: 'claim.invoice_recorded',
      entityType: 'client_claims', entityId: parseInt(req.params.claim_id, 10),
      details: { project_id: parseInt(req.params.project_id, 10), invoice_number, invoice_date: invoice_date || null }, req });

    // Claim is now invoiced — tell finance admins (who track receivables) that the
    // GST invoice number is recorded. Fire-and-forget after the transition
    // committed; 'claim_invoiced' is allowlisted in the d11 test.
    (async () => {
      const projName = await users.projectName(req.params.project_id);
      const msg = `nu PMC: Client claim invoiced — invoice ${invoice_number} recorded `
        + `on ${projName || ('project ' + req.params.project_id)}.`;
      const financeRecipients = await users.financeAdmins('id');
      const { notify } = require('../../../services/notifications');
      for (const fa of financeRecipients) await notify(fa.id, 'claim_invoiced', msg);
    })().catch(_e => { /* notification failure — non-blocking */ });

    res.json({ success: true, message: 'Invoice number recorded — claim marked as invoiced' });
  }));

module.exports = router;
