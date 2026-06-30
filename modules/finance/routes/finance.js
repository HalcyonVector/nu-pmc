// routes/finance.js — Petty cash, principal direct payments, client receipts, TDS, advance recovery
const express = require('express');
const db      = require('../../../middleware/db');
const { validators } = require('../../../middleware/validate');
const { requireAuth, requirePrincipal, requirePMC, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { upload } = require('../../../middleware/upload');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const { HEADS_WITH_FINANCE: ALL_HEADS_FIN, FINANCE_ROLES, PMC_ROLES } = require('../../../services/roles');
const router  = express.Router();


// ── PETTY CASH

router.get('/:project_id/petty-cash', requireAuth, requireRole(...FINANCE_ROLES), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [txns] = await db.query(
      `SELECT * FROM petty_cash_transactions
       WHERE project_id = ? ORDER BY txn_date DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(txns.flatMap(t => [t.recorded_by, t.approved_by].filter(Boolean)));
    const fileUrls = require('../../../services/file-url');
    txns.forEach(t => {
      t.recorded_by_name = users.get(t.recorded_by)?.full_name || null;
      t.approved_by_name = users.get(t.approved_by)?.full_name || null;
      t.bill_url = t.file_path ? fileUrls.fileUrl(t.file_path) : null;
    });
    // Calculate balance
    const opens  = txns.filter(t=>t.txn_type==='replenishment').reduce((s,t)=>s+parseFloat(t.amount),0);
    const spends = txns.filter(t=>t.txn_type==='spend').reduce((s,t)=>s+parseFloat(t.amount),0);
    const balance = opens - spends;
    res.json({ transactions: txns, balance, total_spent: spends, total_replenished: opens });
  }));

router.post('/:project_id/petty-cash', requireAuth, requireProjectScope(), requirePMC, upload.single('bill'), asyncHandler(async (req, res) => {
    const { txn_date, description, amount, category } = req.body;
    if (!txn_date || !description || !amount) return res.status(400).json({ error: 'Required fields missing' });
    // Numeric validation
    const { validateAmount } = require('../../../services/payment-validation');
    const amtCheck = validateAmount(amount, 'Amount');
    if (!amtCheck.ok) return res.status(400).json({ error: amtCheck.error, code: 'INVALID_AMOUNT' });
    // Check float limit
    const [[scope]] = await db.query('SELECT petty_cash_txn_limit FROM project_scope WHERE project_id = ?', [req.params.project_id]);
    if (scope?.petty_cash_txn_limit && amtCheck.amount > parseFloat(scope.petty_cash_txn_limit)) {
      return res.status(400).json({ error: `Transaction exceeds limit of ₹${scope.petty_cash_txn_limit}` });
    }
    const [pcResult] = await db.query(
      `INSERT INTO petty_cash_transactions (project_id, txn_date, description, amount, txn_type, category, bill_available, file_path, recorded_by)
       VALUES (?,?,?,?,'spend',?,?,?,?)`,
      [req.params.project_id, txn_date, description, amtCheck.amount, category||'other', req.file?1:0, req.file?.path||null, req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'petty_cash.spend',
      entityType: 'petty_cash_transactions', entityId: pcResult.insertId,
      details: { project_id: parseInt(req.params.project_id, 10), amount: amtCheck.amount, category: category||'other', description, txn_date, bill_available: req.file?1:0 }, req });
    res.json({ success: true });
  }));

// PMC Head replenishes up to ₹25,000. Above that — needs principal approval.
router.post('/:project_id/petty-cash/replenish', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const { amount, notes } = req.body;
    const { validateAmount } = require('../../../services/payment-validation');
    const amtCheck = validateAmount(amount, 'Amount');
    if (!amtCheck.ok) return res.status(400).json({ error: amtCheck.error, code: 'INVALID_AMOUNT' });
    const PETTY_CASH_THRESHOLD = parseInt(process.env.PETTY_CASH_THRESHOLD || "25000", 10);
    if (amtCheck.amount > PETTY_CASH_THRESHOLD) {
      const me = req.session.user;
      if (!['principal','design_principal'].includes(me.role)) {
        return res.status(403).json({
          error: `Replenishment above ₹${PETTY_CASH_THRESHOLD.toLocaleString('en-IN')} requires Principal or Design Principal approval.`,
          requires_principal: true,
        });
      }
    }
    const [rpResult] = await db.query(
      `INSERT INTO petty_cash_transactions (project_id, txn_date, description, amount, txn_type, category, recorded_by, approved_by)
       VALUES (?,CURDATE(),?,?,'replenishment','other',?,?)`,
      [req.params.project_id, notes||'Float replenishment', amtCheck.amount, req.session.user.id, req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'petty_cash.replenish',
      entityType: 'petty_cash_transactions', entityId: rpResult.insertId,
      details: { project_id: parseInt(req.params.project_id, 10), amount: amtCheck.amount, notes: notes||'Float replenishment', threshold_check: amtCheck.amount > PETTY_CASH_THRESHOLD ? 'principal_approval' : 'pmc_approval' }, req });

    // Notify Finance Admin — petty cash replenishment requested (C2, friction-reduction brief)
    try {
      const signoffGate = require('../../../services/signoff-gate');
      await signoffGate.triggerSignoff(
        'petty_cash_replenishment',
        rpResult.insertId,
        parseInt(req.params.project_id, 10),
        {
          question: `Petty cash replenishment — ₹${amtCheck.amount.toLocaleString('en-IN')}${notes ? ' — ' + notes.slice(0, 60) : ''}. Approve?`,
          triggeredBy: req.session.user.id,
        }
      );
    } catch (e) {
      console.warn('[petty-cash] finance replenishment poll failed:', e.message);
    }

    res.json({ success: true });
  }));

// ── PRINCIPAL DIRECT PAYMENTS (UPI / cash)

router.get('/:project_id/direct-payments', requireAuth, requireRole(...PMC_ROLES, 'finance_admin', 'principal', 'design_principal'), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [payments] = await db.query(
      `SELECT * FROM principal_direct_payments
       WHERE project_id = ? ORDER BY payment_date DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(payments.flatMap(p => [p.recorded_by, p.tagged_by].filter(Boolean)));
    const fileUrls = require('../../../services/file-url');
    payments.forEach(p => {
      p.recorded_by_name = users.get(p.recorded_by)?.full_name || null;
      p.tagged_by_name   = users.get(p.tagged_by)?.full_name   || null;
      p.receipt_url = p.file_path ? fileUrls.fileUrl(p.file_path) : null;
    });
    res.json({ payments });
  }));

router.post('/:project_id/direct-payments', requireAuth, requireProjectScope(), requirePrincipal, upload.single('receipt'), asyncHandler(async (req, res) => {
    const { payment_date, payment_type, amount, paid_to, description, upi_ref, boq_head } = req.body;
    if (!payment_date || !amount || !paid_to || !description) return res.status(400).json({ error: 'Required fields missing' });

    // FinanceAudit 3.4 — payment_type must be explicit, not silently defaulted.
    // Previously `payment_type||'upi'` meant forgotten dropdown → recorded as UPI.
    // Audit trail misclassified cash/bank/other payments as UPI.
    const VALID_PAYMENT_TYPES = ['upi', 'cash', 'bank_transfer', 'cheque', 'card', 'other'];
    if (!payment_type) {
      return res.status(400).json({ error: 'payment_type is required', code: 'PAYMENT_TYPE_MISSING' });
    }
    if (!VALID_PAYMENT_TYPES.includes(payment_type)) {
      return res.status(400).json({
        error: `Invalid payment_type '${payment_type}'. Must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`,
        code: 'PAYMENT_TYPE_INVALID',
      });
    }

    const { validateAmount } = require('../../../services/payment-validation');
    const amtCheck = validateAmount(amount, 'Amount');
    if (!amtCheck.ok) return res.status(400).json({ error: amtCheck.error });

    const [dpResult] = await db.query(
      `INSERT INTO principal_direct_payments (project_id, payment_date, payment_type, amount, paid_to, description, upi_ref, file_path, boq_head, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.params.project_id, payment_date, payment_type, amtCheck.amount, paid_to, description,
       upi_ref||null, req.file?.path||null, boq_head||null, req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'direct_payment.record',
      entityType: 'principal_direct_payments', entityId: dpResult.insertId,
      details: { project_id: parseInt(req.params.project_id, 10), payment_date, payment_type, amount: amtCheck.amount, paid_to, description, upi_ref: upi_ref || null, boq_head: boq_head || null }, req });
    res.json({ success: true });
  }));

// ── CLIENT RECEIPTS

router.get('/:project_id/client-receipts', requireAuth, requireRole(...ALL_HEADS_FIN), asyncHandler(async (req, res) => {
    const me = req.session.user;
    const [receipts] = await db.query(
      `SELECT cr.*, pi.pi_number
       FROM client_receipts cr
       JOIN proforma_invoices pi ON cr.pi_id = pi.id
       WHERE cr.project_id = ? ORDER BY cr.receipt_date DESC`,
      [req.params.project_id]
    );
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(receipts.map(r => r.recorded_by).filter(Boolean));
    receipts.forEach(r => { r.recorded_by_name = users.get(r.recorded_by)?.full_name || null; });
    res.json({ receipts });
  }));

router.post('/:project_id/client-receipts', requireAuth, requireProjectScope(), requireRole(...FINANCE_ROLES), asyncHandler(async (req, res) => {
    const { ClientReceipt, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(ClientReceipt, req, res);
    if (!body) return;

    // Cross-field check that can't live in the schema (tds ≤ amount)
    if (body.tds_deducted > body.amount_received) {
      return res.status(400).json({ error: 'TDS cannot exceed amount received', code: 'TDS_EXCEEDS_AMOUNT' });
    }
    const net = body.amount_received - body.tds_deducted;

    // Wrap receipt + TDS + PI-paid in a single transaction.
    // Rationale (FinanceAudit 2.6): prior to this fix the three writes were
    // sequential and non-atomic. If the TDS INSERT or the PI UPDATE failed
    // after the receipt INSERT succeeded, we'd end up with a partial write:
    // receipt recorded but TDS missing (wrong GST statement) or PI still
    // pending (dashboard inconsistent with ledger).
    const receiptId = await db.tx(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO client_receipts (project_id, pi_id, receipt_date, amount_received, tds_deducted, net_received, utr, bank_ref, notes, recorded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [req.params.project_id, body.pi_id, body.receipt_date, body.amount_received, body.tds_deducted, net,
         body.utr, body.bank_ref, body.notes, req.session.user.id]
      );

      if (body.tds_deducted > 0) {
        const [[pi]] = await conn.query('SELECT amount_ex_gst, gst_pct FROM proforma_invoices WHERE id = ?', [body.pi_id]);
        const tdsRate = pi ? Math.round(body.tds_deducted / pi.amount_ex_gst * 100 * 100) / 100 : 10;
        await conn.query(
          'INSERT INTO tds_records (project_id, pi_id, receipt_id, tds_amount, tds_rate) VALUES (?,?,?,?,?)',
          [req.params.project_id, body.pi_id, result.insertId, body.tds_deducted, tdsRate]
        );
      }

      // Read current state and transition. PI may be in 'sent' or 'acknowledged'
      // depending on whether it was opened by the client before payment landed.
      const [[curPi]] = await conn.query('SELECT status FROM proforma_invoices WHERE id = ?', [body.pi_id]);
      if (curPi) {
        const sm = require('../../../services/state-machines').proformaInvoice;
        await sm.transition({
          id: body.pi_id, from: curPi.status, to: 'paid',
          extraCols: { paid_at: new Date() },
          conn,
        });
      }

      return result.insertId;
    });

    audit.log({ userId: req.session.user.id, action: 'client_receipt.record',
      entityType: 'client_receipts', entityId: receiptId,
      details: { project_id: parseInt(req.params.project_id, 10), pi_id: body.pi_id, receipt_date: body.receipt_date, amount_received: body.amount_received, tds_deducted: body.tds_deducted, net_received: net, utr: body.utr }, req });

    res.json({ success: true, id: receiptId, net_received: net, tds_recorded: body.tds_deducted > 0 });
  }));

// ── ADVANCE RECOVERY

router.get('/advance-recovery/:engagement_id', requireAuth,
  requireRole('principal','design_principal','pmc_head','finance_admin'),
  asyncHandler(async (req, res) => {
    const [schedules] = await db.query(
      'SELECT * FROM advance_recovery_schedule WHERE engagement_id = ?', [req.params.engagement_id]
    );
    res.json({ schedules });
  }));

router.post('/advance-recovery', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { AdvanceRecovery, parseOr400 } = require('../../../services/schemas');
    const body = parseOr400(AdvanceRecovery, req, res);
    if (!body) return;
    const { engagement_id, advance_type, advance_amount, advance_date, recovery_pct_per_bill } = body;
    const [arResult] = await db.query(
      `INSERT INTO advance_recovery_schedule (engagement_id, advance_type, advance_amount, advance_date, recovery_pct_per_bill, created_by)
       VALUES (?,?,?,?,?,?)`,
      [engagement_id, advance_type||'mobilisation', advance_amount, advance_date, recovery_pct_per_bill||10, req.session.user.id]
    );
    audit.log({ userId: req.session.user.id, action: 'advance_recovery.create',
      entityType: 'advance_recovery_schedule', entityId: arResult.insertId,
      details: { engagement_id: parseInt(engagement_id, 10), advance_type: advance_type||'mobilisation', advance_amount: parseFloat(advance_amount) }, req });
    res.json({ success: true, id: arResult.insertId });
}));

// ── FINANCE MORNING BRIEF (cross-project, Finance Admin only)
router.get('/morning-brief', requireAuth, requireRole('finance_admin','principal','design_principal','pmc_head'), asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [[pendingPay]]     = await db.query(`SELECT COUNT(*) AS n FROM payment_requests WHERE status IN ('pmc_approved','principal_approved') AND is_urgent=0 AND DATE(raised_at) >= DATE_SUB(CURDATE(),INTERVAL 7 DAY)`);
  const [[todayReqs]]      = await db.query(`SELECT COUNT(*) AS n FROM payment_requests WHERE is_urgent=0 AND DATE(raised_at)=?`, [today]);
  const [[todayUrgent]]    = await db.query(`SELECT COUNT(*) AS n FROM payment_requests WHERE is_urgent=1 AND DATE(raised_at)=?`, [today]);
  const [[todayPettyCash]] = await db.query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM petty_cash_transactions WHERE DATE(txn_date)=? AND txn_type='spend'`, [today]);
  const [[todayDirectPay]] = await db.query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM principal_direct_payments WHERE DATE(payment_date)=?`, [today]);
  const [[overduePI]]      = await db.query(`SELECT COUNT(*) AS n FROM proforma_invoices WHERE status IN ('draft','sent') AND raised_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
  const [[weekPI]]         = await db.query(`SELECT COUNT(*) AS n, COALESCE(SUM(amount_ex_gst),0) AS total FROM proforma_invoices WHERE raised_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);

  // Recent payment requests (last 5)
  const [recentReqs] = await db.query(
    `SELECT pr.id, pr.amount_requested, pr.payment_type, pr.status, pr.raised_at AS created_at,
            p.name AS project_name, v.vendor_name
     FROM payment_requests pr
     JOIN projects p ON pr.project_id = p.id
     LEFT JOIN vendor_engagements e ON pr.engagement_id = e.id
     LEFT JOIN vendors v ON e.vendor_id = v.id
     ORDER BY pr.raised_at DESC LIMIT 5`
  );

  // Recent petty cash (last 5)
  const [recentPetty] = await db.query(
    `SELECT pc.amount, pc.description, pc.txn_date, pc.category, p.name AS project_name
     FROM petty_cash_transactions pc
     JOIN projects p ON pc.project_id = p.id
     WHERE pc.txn_type='spend'
     ORDER BY pc.txn_date DESC, pc.id DESC LIMIT 5`
  );

  res.json({
    today,
    pending_payments:   pendingPay.n,
    today_requests:     todayReqs.n,
    today_urgent:       todayUrgent.n,
    today_petty_count:  todayPettyCash.n,
    today_petty_total:  parseFloat(todayPettyCash.total),
    today_direct_count: todayDirectPay.n,
    today_direct_total: parseFloat(todayDirectPay.total),
    overdue_pi:         overduePI.n,
    week_pi_count:      weekPI.n,
    week_pi_total:      parseFloat(weekPI.total),
    recent_requests:    recentReqs,
    recent_petty:       recentPetty,
  });
}));

module.exports = router;
