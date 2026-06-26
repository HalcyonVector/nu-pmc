// routes/payment-requests.js
// ============================================================
// STANDARD VENDOR PAYMENT LANE
// Raise → M/P review → Principal approval (if above threshold) → Finance Admin pays
//
// nu PMC has TWO payment lanes by design (NOT a duplication; healthy split):
//
//   1. THIS FILE — standard vendor payment lane. Assumes vendor is in the
//      vendor master, has a registered engagement, has GRNs / RA-bills
//      backing the request. Full approval chain, ICICI bulk export.
//
//   2. modules/finance/routes/urgent-payments.js — fast-path lane. For
//      "boy is standing at the shop to buy a tap and needs to pay
//      immediately." Vendor not yet in master, but the spend must still
//      be documented. Different state machine because different lifecycle.
//
// Different state machines on the same outcome ("vendor gets paid"). DO NOT MERGE.
// ============================================================
const express  = require('express');
const db       = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth, requirePMC, requirePrincipal, requireRole, requireProjectScope, requireScopeFromEntity } = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/permissions');
const { upload } = require('../../../middleware/upload');
const router        = express.Router();
// (waInteractive / waReply imports removed — only the urgent-payment
// auto-approve flow used them, now migrated to services/signoff-gate.)
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');

// ── HELPERS
async function getProjectThreshold(projectId) {
  const Onboarding = require('../../onboarding/contract');
  const p = await Onboarding.functions.getProject(projectId);
  return parseFloat(p?.payment_approval_threshold || 25000);
}

async function notifyWhatsApp(userId, message, messageType = 'payment_request') {
  try {
    const notif = require('../../../services/notifications');
    await notif.notify(userId, messageType, message);
  } catch (e) { console.warn('[payment-requests]', e.message); }
}

async function notifyRole(role, message, projectId) {
  try {
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsersByRole(role, projectId);
    for (const u of users) await notifyWhatsApp(u.id, message);
  } catch (e) { console.warn('[payment-requests]', e.message); }
}

// ── GET /api/payment-requests/:project_id — list requests
router.get('/:project_id', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head','finance_admin','senior_site_manager','site_manager'),
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    let where = 'pr.project_id = ?';
    const params = [req.params.project_id];
    if (status) { where += ' AND pr.status = ?'; params.push(status); }

    const [requests] = await db.query(
      `SELECT * FROM payment_requests pr
       WHERE ${where}
       ORDER BY pr.raised_at DESC
       LIMIT 200`,
      params
    );
    const Onboarding = require('../../onboarding/contract');
    const vendors = await Onboarding.functions.getVendorsByIds(requests.map(r => r.vendor_id));
    requests.forEach(r => {
      const v = vendors.get(r.vendor_id);
      r.vendor_name  = v?.vendor_name || null;
      r.vendor_trade = v?.trade || null;
    });
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(
      requests.flatMap(r => [r.requested_by, r.pmc_reviewed_by, r.principal_reviewed_by].filter(Boolean))
    );
    requests.forEach(r => {
      r.requested_by_name        = users.get(r.requested_by)?.full_name || null;
      r.pmc_reviewed_by_name     = users.get(r.pmc_reviewed_by)?.full_name || null;
      r.principal_reviewed_by_name  = users.get(r.principal_reviewed_by)?.full_name || null;
    });
    res.json({ requests });
  }));

// ── POST /api/payment-requests/:project_id — raise a request
router.post('/:project_id', requireAuth, requireProjectScope(),
  upload.array('evidence', 5),
  asyncHandler(async (req, res) => {
    const { PaymentRequestCreate, parseOr400 } = require('../../../services/schemas');
    // Zod handles: required fields, amount>0, GST range, GSTIN/PAN/IFSC format
    // engagement_id is NOT marked required here because vendor_id is an alternative
    const loose = PaymentRequestCreate.partial({ engagement_id: true }).safeParse(req.body);
    if (!loose.success) {
      return res.status(400).json({
        error: 'Invalid input',
        issues: loose.error.issues.map(i => ({ field: i.path.join('.') || '(root)', message: i.message })),
      });
    }
    const body = loose.data;
    const me = req.session.user;

    // Only allowed roles can raise (M01 audit: senior + regular site managers both allowed)
    const allowed = ['site_manager','senior_site_manager','design_head','services_head','pmc_head','principal','design_principal'];
    if (!allowed.includes(me.role)) {
      return res.status(403).json({ error: 'You are not permitted to raise payment requests' });
    }

    // Derive vendor_id from engagement if not explicitly provided
    let vendor_id = body.vendor_id;
    const engagement_id = body.engagement_id || null;
    const Onboarding = require('../../onboarding/contract');
    if (!vendor_id && engagement_id) {
      const engMap = await Onboarding.functions.getEngagementsByIds([engagement_id]);
      const eng = engMap.get(engagement_id);
      if (eng) vendor_id = eng.vendor_id;
    }

    if (!vendor_id && !body.is_adhoc) {
      return res.status(400).json({ error: 'Vendor (or engagement) is required' });
    }

    // ── M01 AUDIT GATE: Vendor must be cleared by finance before PR can be raised.
    // Ad-hoc shop purchases bypass this gate (no vendor master by design).
    if (vendor_id && !body.is_adhoc) {
      const vMap = await Onboarding.functions.getVendorsByIds([vendor_id]);
      const v = vMap.get(vendor_id);
      if (!v) return res.status(404).json({ error: 'Vendor not found' });
      if (v.clearance_status === 'rejected') {
        return res.status(403).json({
          error: `${v.vendor_name} was rejected by finance. Payment cannot be raised.`,
          code: 'VENDOR_REJECTED',
        });
      }
      if (v.clearance_status !== 'cleared') {
        return res.status(403).json({
          error: `${v.vendor_name} is pending finance clearance. Payment cannot be raised until cleared.`,
          code: 'VENDOR_NOT_CLEARED',
        });
      }
    }

    // ── M03 AUDIT GATE: Engagement must be approved by principal before PR.
    // Applies when engagement_id is provided; ad-hoc and adhoc-vendor-no-engagement
    // purchases bypass. Legacy engagements backfilled as 'approved' in migration.
    if (engagement_id && !body.is_adhoc) {
      const engMap2 = await Onboarding.functions.getEngagementsByIds([engagement_id]);
      const eng = engMap2.get(engagement_id);
      if (!eng) return res.status(404).json({ error: 'Engagement not found' });
      if (eng.approval_status === 'rejected') {
        return res.status(403).json({
          error: `Engagement with ${eng.vendor_name} was rejected: ${eng.rejection_reason || 'see engagement'}`,
          code: 'ENGAGEMENT_REJECTED',
        });
      }
      if (eng.approval_status !== 'approved') {
        return res.status(403).json({
          error: `Engagement with ${eng.vendor_name} is pending principal approval. Payment cannot be raised until approved.`,
          code: 'ENGAGEMENT_NOT_APPROVED',
        });
      }
    }

    const validAmount = body.amount_requested;
    const validGST    = body.gst_rate;

    // ── CONTRACT VALUE + CUMULATIVE CHECK (business rule — stays inline)
    const { checkPaymentSanity } = require('../../../services/payment-validation');
    const sanity = await checkPaymentSanity(engagement_id, vendor_id, validAmount);
    if (!sanity.ok) {
      return res.status(400).json({
        error: sanity.error,
        code: 'PAYMENT_EXCEEDS_CONTRACT',
        contract_value: sanity.contractValue,
        already_committed: sanity.committed,
        pending: sanity.pending,
        remaining: sanity.remaining,
      });
    }
    // Invoice enforcement by payment type (check BEFORE evidence so invoice_required flag is returned)
    const INVOICE_REQUIRED = ['running_account_bill','final_bill'];
    const pType = body.payment_type || 'other';
    const hasInvoice = (req.files||[]).some(f =>
      f.fieldname === 'invoice' || f.mimetype === 'application/pdf' ||
      (f.originalname||'').toLowerCase().includes('invoice')
    );
    const invoiceOverride = body.invoice_override_reason;

    if (INVOICE_REQUIRED.includes(pType) && !hasInvoice && !invoiceOverride) {
      return res.status(400).json({
        error: 'Tax invoice required for ' + pType.replace(/_/g,' ') + ' — attach invoice PDF or provide override reason',
        invoice_required: true,
      });
    }

    // Evidence check — advances don't need it; RA bills with override still need some evidence
    const ADVANCE_TYPES = ['mobilisation_advance','material_advance','advance'];
    const isAdvance = ADVANCE_TYPES.includes(body.payment_type);
    if (!isAdvance && !invoiceOverride && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Supporting evidence (photo, RA bill, or measurement sheet) is required' });
    }

    // TRANSACTION: payment request + all evidence files must succeed together
    const prId = await db.tx(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO payment_requests
         (project_id, vendor_id, engagement_id, requested_by, amount_requested, reason, payment_type,
          is_urgent, is_adhoc, adhoc_name, adhoc_phone, adhoc_gstin, adhoc_pan,
          adhoc_bank_account, adhoc_bank_ifsc, adhoc_upi_id, payment_lane,
          invoice_override_reason, gst_rate, hsn_code, is_interstate)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.params.project_id, vendor_id||null, engagement_id, me.id, validAmount, body.reason, body.payment_type || 'other',
         body.is_urgent ? 1 : 0, body.is_adhoc ? 1 : 0,
         body.adhoc_name, body.adhoc_phone, body.adhoc_gstin, body.adhoc_pan,
         body.adhoc_bank_account, body.adhoc_bank_ifsc, body.adhoc_upi_id,
         body.payment_lane || 'icici_bulk',
         invoiceOverride||null, validGST, body.hsn_code,
         body.is_interstate ? 1 : 0]
      );
      const id = result.insertId;
      // Save evidence files atomically with the request
      for (const file of (req.files || [])) {
        const type = file.mimetype.includes('image') ? 'photo' : 'ra_bill';
        await conn.query(
          'INSERT INTO payment_request_evidence (payment_request_id, file_path, file_type, uploaded_by) VALUES (?,?,?,?)',
          [id, file.path, type, me.id]
        );
      }
      return id;
    });

    // Notify M/P
    await notifyRole('pmc_head',
      `Payment request raised by ${me.full_name} — ₹${validAmount.toLocaleString('en-IN')} — ${body.reason.slice(0,50)}. Review in app.`,
      req.params.project_id
    );

    // Notify Finance Admin — payment request created (C1, friction-reduction brief)
    // Finance sees every new request so they can plan the batch.
    // Poll: ✅ Noted — add to next batch / ❌ Hold — need more info
    try {
      const signoffGate = require('../../../services/signoff-gate');
      await signoffGate.triggerSignoff(
        'payment_request_finance_review',
        prId,
        parseInt(req.params.project_id, 10),
        {
          question: `Payment request — ${body.reason?.slice(0, 60) || 'new request'} — ₹${validAmount.toLocaleString('en-IN')}`,
          documentRow: { id: prId, raised_by: me.id },
          triggeredBy: me.id,
        }
      );
    } catch (e) {
      console.warn('[payment-requests] finance review poll failed:', e.message);
    }

    // Urgent payment — auto-approve if below petty cash threshold
    const pettyCashThreshold = parseInt(process.env.PETTY_CASH_THRESHOLD || '25000', 10);
    if (body.is_urgent && validAmount <= pettyCashThreshold) {
      const { paymentRequest: prSM } = require('../../../services/state-machines');
      await prSM.transition({
        id: prId, from: 'pending_pmc', to: 'pmc_approved',
        extraCols: {
          pmc_reviewed_by: me.id,
          pmc_reviewed_at: new Date(),
          pmc_notes: 'Auto-approved: urgent below threshold',
        },
        audit: { userId: me.id, req, details: { source: 'urgent_auto_approve' } },
      }).catch(e => { throw e; });
      // Notify PMC via signoff-gate. Phase 3: replaced WhatsApp dispatch +
      // waReply.registerPendingAction with single triggerSignoff. Per
      // signoff_workflows seed, urgent_payment_fyi is a single-poll FYI
      // to the project's PMC head with a 4-hour close window.
      try {
        const Onboarding = require('../../onboarding/contract');
        const vendorMap = await Onboarding.functions.getVendorsByIds([vendor_id]);
        const vendorName = vendorMap.get(vendor_id)?.vendor_name || 'Vendor';
        const signoffGate = require('../../../services/signoff-gate');
        await signoffGate.triggerSignoff(
          'urgent_payment_fyi',
          prId,
          parseInt(req.params.project_id, 10),
          {
            question: `Urgent payment auto-approved — ${vendorName} ₹${validAmount.toLocaleString('en-IN')} — note?`,
            documentRow: { id: prId, raised_by: me.id },
            triggeredBy: me.id,
          }
        ).catch(e => console.warn('[payment-requests signoffGate.triggerSignoff]', e.message));
      } catch(_pe) { /* non-blocking */ }

      return res.json({ success: true, id: prId, auto_approved: true,
        message: `Urgent payment auto-approved — ₹${validAmount.toLocaleString('en-IN')}. PMC notified.` });
    }

    res.json({ success: true, id: prId, message: 'Payment request raised. PMC notified.', warning: sanity.warning || undefined });
  }));

// ── PATCH /api/payment-requests/:id/pmc-review — M/P approves or rejects
router.patch('/:id/pmc-review', requireAuth, requirePMC, asyncHandler(async (req, res) => {
    const { action } = req.body;
    if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Action must be approve or reject' });

    // For approve, validate the review body shape
    let reviewBody = { pmc_amount: null, pmc_notes: null };
    if (action === 'approve' || req.body.pmc_amount !== undefined) {
      const { PaymentReviewPMC, parseOr400 } = require('../../../services/schemas');
      const partial = PaymentReviewPMC.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({
          error: 'Invalid input',
          issues: partial.error.issues.map(i => ({ field: i.path.join('.') || '(root)', message: i.message })),
        });
      }
      reviewBody = { ...reviewBody, ...partial.data };
    } else {
      // Reject — just grab notes
      reviewBody.pmc_notes = req.body.pmc_notes || null;
    }

    const [[pr]] = await db.query('SELECT * FROM payment_requests WHERE id = ?', [req.params.id]);
    if (!pr) return res.status(404).json({ error: 'Request not found' });
    // NOTE: no pre-check of pr.status here — state machine's transition call
    // below enforces current status atomically and throws INVALID_STATE_TRANSITION
    // (now 400 via central handler) if not pending_pmc. Pre-check was a stale-read
    // hazard: value at SELECT could already be out of date by UPDATE time.

    const me = req.session.user;
    const { paymentRequest: prSM } = require('../../../services/state-machines');

    if (action === 'reject') {
      await prSM.transition({
        id: parseInt(req.params.id, 10), from: pr.status, to: 'pmc_rejected',
        extraCols: {
          pmc_reviewed_by: me.id,
          pmc_reviewed_at: new Date(),
          pmc_notes: reviewBody.pmc_notes,
        },
        audit: { userId: me.id, req, details: { pmc_notes: reviewBody.pmc_notes || null } },
      });
      await notifyWhatsApp(pr.requested_by, `Payment request rejected by PMC. Reason: ${reviewBody.pmc_notes || 'See app for details'}`);
      return res.json({ success: true, message: 'Request rejected. Requester notified.' });
    }

    // Approve — Zod already validated pmc_amount shape; still need cross-field check
    const { fmtRupee } = require('../../../services/payment-validation');
    let approvedAmount = reviewBody.pmc_amount !== null && reviewBody.pmc_amount !== undefined
      ? reviewBody.pmc_amount
      : parseFloat(pr.amount_requested);

    // PMC can reduce but should not increase above requested amount (guard against fat finger)
    if (approvedAmount > parseFloat(pr.amount_requested) * 1.0001) {
      return res.status(400).json({
        error: `PMC amount ${fmtRupee(approvedAmount)} cannot exceed requested amount ${fmtRupee(pr.amount_requested)}`
      });
    }
    const threshold = await getProjectThreshold(pr.project_id);

    if (approvedAmount >= threshold) {
      // Needs Principal approval — transition to pending_principal
      await prSM.transition({
        id: parseInt(req.params.id, 10), from: pr.status, to: 'pending_principal',
        extraCols: {
          pmc_reviewed_by: me.id, pmc_reviewed_at: new Date(),
          pmc_amount: approvedAmount, pmc_notes: reviewBody.pmc_notes,
        },
        audit: { userId: me.id, req, details: { pmc_amount: approvedAmount } },
      });
      // Notify Principal + Design Principal
      const principals = await users.principals();
      for (const p of principals) {
        await notifyWhatsApp(p.id,
          `Payment request ${fmtRupee(approvedAmount)} approved by PMC — above project threshold ${fmtRupee(threshold)}. Your approval needed.`
        );
      }
      res.json({ success: true, message: `Above threshold (${fmtRupee(threshold)}). Sent to Principal for approval.` });
    } else {
      // Below threshold — fast-path to principal_approved (Finance Admin can pay without Principal review)
      await prSM.transition({
        id: parseInt(req.params.id, 10), from: pr.status, to: 'principal_approved',
        extraCols: {
          pmc_reviewed_by: me.id, pmc_reviewed_at: new Date(),
          pmc_amount: approvedAmount, pmc_notes: reviewBody.pmc_notes,
        },
        audit: { userId: me.id, req, details: { source: 'fast_path_below_threshold', pmc_amount: approvedAmount } },
      });
      // Notify Finance Admin
      const finance = await users.financeAdmins();
      for (const f of finance) {
        await notifyWhatsApp(f.id,
          `Payment request approved — ₹${approvedAmount.toLocaleString('en-IN')} — below auto-approval threshold. Ready to pay.`
        );
      }
      res.json({ success: true, message: `Below threshold. Auto-approved. Finance Admin notified.` });
    }
  }));

// ── PATCH /api/payment-requests/:id/principal-review — Principal approves or rejects
router.patch('/:id/principal-review', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
    const { action } = req.body;
    if (!['approve','reject'].includes(action)) return res.status(400).json({ error: 'Action must be approve or reject' });

    const { PaymentReviewPrincipal } = require('../../../services/schemas');
    const parsed = PaymentReviewPrincipal.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        issues: parsed.error.issues.map(i => ({ field: i.path.join('.') || '(root)', message: i.message })),
      });
    }
    const reviewBody = parsed.data;

    const [[pr]] = await db.query('SELECT * FROM payment_requests WHERE id = ?', [req.params.id]);
    if (!pr) return res.status(404).json({ error: 'Request not found' });
    // NOTE: state machine enforces pending_principal atomically below. No pre-check here.

    const me = req.session.user;
    const newStatus = action === 'approve' ? 'principal_approved' : 'principal_rejected';
    const { paymentRequest: prSM } = require('../../../services/state-machines');

    // M01 audit — rs_override: advance/final/retention require the correct R/S to
    // have weighed in. Current state machine has no R/S step, so any principal-only
    // approval of these types is flagged. Finance dashboard surfaces these counts.
    const RS_REQUIRED = ['mobilisation_advance','material_advance','advance','final_bill','retention_release'];
    let rsOverride = 0;
    if (action === 'approve' && RS_REQUIRED.includes(pr.payment_type)) {
      // Derive stream from vendor's trade (vendors table has no stream column;
      // the original code referenced v.stream which never existed — pre-existing
      // bug that would have returned undefined at runtime). Mapping matches the
      // drawings table category→stream convention.
      const DESIGN_TRADES   = new Set(['civil','structural','finishes','architectural','interior']);
      const SERVICES_TRADES = new Set(['electrical','hvac','plumbing','fire','it','mep']);
      let stream = null;
      const Onboarding = require('../../onboarding/contract');
      if (pr.engagement_id) {
        const engMap3 = await Onboarding.functions.getEngagementsByIds([pr.engagement_id]);
        const e = engMap3.get(pr.engagement_id);
        if (e?.vendor_id) {
          const vMap = await Onboarding.functions.getVendorsByIds([e.vendor_id]);
          const trade = (vMap.get(e.vendor_id)?.trade || '').toLowerCase();
          if (DESIGN_TRADES.has(trade))   stream = 'design';
          else if (SERVICES_TRADES.has(trade)) stream = 'services';
        }
      }
      // The correct R/S for this stream is design_head (design) or services_head (services).
      // Approver being that R/S would mean no override. In the current flow the approver is
      // always a principal (requirePrincipal gate) so this effectively always flags —
      // which is the honest signal: no R/S step exists yet in the workflow.
      const approverIsCorrectRS =
        (stream === 'design'   && me.role === 'design_head') ||
        (stream === 'services' && me.role === 'services_head');
      if (!approverIsCorrectRS) rsOverride = 1;
    }

    await prSM.transition({
      id: parseInt(req.params.id, 10), from: pr.status, to: newStatus,
      extraCols: {
        principal_reviewed_by: me.id,
        principal_reviewed_at: new Date(),
        principal_notes: reviewBody.principal_notes,
        rs_override: rsOverride,
      },
      audit: { userId: me.id, req, details: { principal_notes: reviewBody.principal_notes || null, rs_override: rsOverride, payment_type: pr.payment_type } },
    });

    if (action === 'approve') {
      const finance = await users.financeAdmins();
      for (const f of finance) {
        await notifyWhatsApp(f.id, `Payment request approved by Principal — ₹${parseFloat(pr.pmc_amount||pr.amount_requested).toLocaleString('en-IN')}. Ready to pay.`);
      }
    } else {
      await notifyWhatsApp(pr.requested_by, `Payment request rejected by principal. Reason: ${reviewBody.principal_notes || 'See app for details'}`);
      await notifyWhatsApp(pr.pmc_reviewed_by, `Payment request rejected by Principal. Reason: ${reviewBody.principal_notes || 'See app'}`);
    }

    res.json({ success: true, message: action === 'approve' ? 'Approved. Finance Admin notified.' : 'Rejected. Team notified.' });
  }));

// ── PATCH /api/payment-requests/:id/confirm-payment — Finance Admin confirms payment made
router.patch('/:id/confirm-payment',
  requireAuth,
  requirePermission('finance.payment-request.mark-paid'),
  asyncHandler(async (req, res) => {
    const me = req.session.user;

    const { actual_paid, payment_date, utr_number } = req.body;
    if (!actual_paid || !payment_date || !utr_number) {
      return res.status(400).json({ error: 'Amount, date and UTR are required' });
    }

    const { validateAmount, fmtRupee } = require('../../../services/payment-validation');
    const paidCheck = validateAmount(actual_paid, 'Amount paid');
    if (!paidCheck.ok) return res.status(400).json({ error: paidCheck.error });

    const [[pr]] = await db.query(
      `SELECT * FROM payment_requests WHERE id = ?`, [req.params.id]
    );
    if (!pr) return res.status(404).json({ error: 'Request not found' });
    const Onboarding = require('../../onboarding/contract');
    const prVendor = await Onboarding.functions.getVendorsByIds([pr.vendor_id]);
    const prProj   = await Onboarding.functions.getProject(pr.project_id);
    pr.vendor_name  = prVendor.get(pr.vendor_id)?.vendor_name || null;
    pr.project_name = prProj?.name || null;
    // NOTE: state machine enforces principal_approved atomically below. No pre-check here.

    // Guard: actual_paid should not exceed approved amount (±1% tolerance for rounding)
    const approvedAmt = parseFloat(pr.pmc_amount || pr.amount_requested);
    if (paidCheck.amount > approvedAmt * 1.01) {
      return res.status(400).json({
        error: `Actual paid ${fmtRupee(paidCheck.amount)} exceeds approved amount ${fmtRupee(approvedAmt)} by more than 1%. ` +
               `If this is correct, raise a new payment request for the difference.`
      });
    }

    // M01 audit — principal_override: if a principal confirms payment (stepping in for
    // finance), the audit flag captures it. Finance dashboard shows these counts.
    const principalOverride = (me.role !== 'finance_admin') ? 1 : 0;

    const { paymentRequest: prSM } = require('../../../services/state-machines');
    await prSM.transition({
      id: parseInt(req.params.id, 10), from: pr.status, to: 'paid',
      extraCols: {
        actual_paid: paidCheck.amount,
        payment_date: payment_date,
        utr_number: utr_number,
        paid_by: me.id,
        principal_override: principalOverride,
      },
      audit: { userId: me.id, req, details: { utr_number, actual_paid: paidCheck.amount, principal_override: principalOverride } },
    });

    const amtFmt = fmtRupee(paidCheck.amount);

    // WhatsApp to vendor — vendors are EXTERNAL (no users row), so route via the
    // phone-based notifyPaymentConfirmed path. notifyWhatsApp(userId) would run
    // SELECT ... WHERE id = <phone> → 0 rows → the message is silently dropped.
    const vendorPhone = prVendor.get(pr.vendor_id)?.phone;
    if (vendorPhone) {
      const notif = require('../../../services/notifications');
      await notif.notifyPaymentConfirmed(
        vendorPhone, pr.vendor_name, paidCheck.amount, utr_number, payment_date
      ).catch(e => console.warn('[payment-requests] vendor payment notify:', e.message));
    }

    // WhatsApp to requester
    await notifyWhatsApp(pr.requested_by,
      `Payment confirmed — ${pr.vendor_name} — ₹${amtFmt} — UTR: ${utr_number}`
    );

    // WhatsApp to M/P
    await notifyRole('pmc_head',
      `Payment made — ${pr.vendor_name} — ₹${amtFmt} — UTR: ${utr_number}`,
      pr.project_id
    );

    res.json({ success: true, message: `Payment confirmed. Vendor, requester and PMC notified.` });
  }));

// ── GET /api/payment-requests/summary/weekly — Principal's weekly recap
router.get('/summary/weekly', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
    const [payments] = await db.query(
      `SELECT * FROM payment_requests
       WHERE status = 'paid'
       AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY project_id, payment_date DESC`
    );
    const Onboarding = require('../../onboarding/contract');
    const wVendors = await Onboarding.functions.getVendorsByIds(payments.map(p => p.vendor_id));
    const wProjs   = await Onboarding.functions.getProjectsByIds(payments.map(p => p.project_id));
    payments.forEach(p => {
      p.vendor_name  = wVendors.get(p.vendor_id)?.vendor_name || null;
      p.trade        = wVendors.get(p.vendor_id)?.trade || null;
      p.project_name = wProjs.get(p.project_id)?.name || null;
    });
    const Auth = require('../../auth/contract');
    const users = await Auth.functions.getUsers(payments.map(p => p.requested_by).filter(Boolean));
    payments.forEach(p => { p.requested_by_name = users.get(p.requested_by)?.full_name || null; });

    const total = payments.reduce((s,p) => s + parseFloat(p.actual_paid||0), 0);

    res.json({
      period: 'Last 7 days',
      total_paid: total,
      total_payments: payments.length,
      payments
    });
  }));

// ── PATCH /api/payment-requests/threshold/:project_id — Principal sets per-project threshold
router.patch('/threshold/:project_id', requireAuth, requirePrincipal, asyncHandler(async (req, res) => {
    const { threshold } = req.body;
    const { validateAmount, fmtRupee } = require('../../../services/payment-validation');
    const v = validateAmount(threshold, 'Threshold', { allowZero: true });
    if (!v.ok) return res.status(400).json({ error: v.error });
    const [[prevRow]] = await db.query('SELECT payment_approval_threshold FROM projects WHERE id = ?', [req.params.project_id]);
    await db.query('UPDATE projects SET payment_approval_threshold = ? WHERE id = ?', [v.amount, req.params.project_id]);
    audit.log({ userId: req.session.user.id, action: 'project.threshold_update',
      entityType: 'projects', entityId: parseInt(req.params.project_id, 10),
      details: { previous_threshold: prevRow?.payment_approval_threshold ?? null, new_threshold: v.amount }, req });
    res.json({ success: true, message: `Threshold set to ${fmtRupee(v.amount)}` });
  }));

// GET /api/payment-requests/:project_id/weekly-batch — Returns pending PRs.
// Role-aware status filtering — each role sees items THEY can action:
//   - PMC Head → 'pending_pmc' (move to pmc_approved)
//   - Principal / Design Principal → 'pmc_approved','pending_principal' (move to principal_approved)
//   - Finance Admin → 'principal_approved' (ready for Saturday payment batch → paid)
//   - Design Head / Services Head / Site Mgr / Senior Site / Audit → 'pending_pmc' (read-only view)
// Writing endpoints (batch-approve, single approve) remain role-gated at the write route.
router.get('/:project_id/weekly-batch', requireAuth,
  requireRole('principal','design_principal','pmc_head','design_head','services_head','finance_admin','senior_site_manager','site_manager','audit'),
  asyncHandler(async (req, res) => {
    const role = req.session.user.role;
    let statusClause;
    if (['principal','design_principal'].includes(role)) {
      statusClause = "pr.status IN ('pmc_approved','pending_principal')";
    } else if (role === 'finance_admin') {
      statusClause = "pr.status = 'principal_approved'";
    } else {
      statusClause = "pr.status = 'pending_pmc'";
    }
    const [pending] = await db.query(
      `SELECT pr.* FROM payment_requests pr
       WHERE pr.project_id = ? AND ${statusClause}
       ORDER BY pr.raised_at ASC`,
      [req.params.project_id]
    );
    const Onboarding = require('../../onboarding/contract');
    const pendEngs = await Onboarding.functions.getEngagementsByIds(pending.map(p => p.engagement_id));
    pending.forEach(p => {
      const e = pendEngs.get(p.engagement_id);
      p.vendor_name = e?.vendor_name || null;
      p.scope       = e?.scope || null;
    });
    res.json({ pending, count: pending.length });
  }));

// POST /api/payment-requests/:project_id/batch-approve — PMC approves multiple at once
// Optional optimistic locking: pass { ids: [...], row_versions: { "<id>": <version>, ... } }
// to get 409 response if any record was concurrently modified.
router.post('/:project_id/batch-approve', requireAuth, requireProjectScope(), requirePMC, asyncHandler(async (req, res) => {
    const ids = req.body.ids || req.body.payment_ids;
    const { notes, row_versions } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'No IDs provided' });

    // Optimistic lock check (optional — only runs if row_versions provided)
    if (row_versions && typeof row_versions === 'object') {
      const ol = require('../../../middleware/optimistic-lock');
      for (const id of ids) {
        const clientVersion = row_versions[String(id)];
        if (clientVersion !== undefined) {
          await ol.checkAndIncrement(db, 'payment_requests', id, clientVersion);
        }
      }
    }

    const { paymentRequest: prSM } = require('../../../services/state-machines');
    const approvedIds = [];
    const failedIds   = [];
    for (const id of ids) {
      try {
        // Only batch-approve items currently pending_pmc AND in this project
        const [[row]] = await db.query(
          'SELECT status FROM payment_requests WHERE id = ? AND project_id = ?',
          [id, req.params.project_id]
        );
        if (!row || row.status !== 'pending_pmc') { failedIds.push(id); continue; }

        await prSM.transition({
          id, from: 'pending_pmc', to: 'pmc_approved',
          extraCols: {
            pmc_reviewed_by: req.session.user.id,
            pmc_reviewed_at: new Date(),
            pmc_notes: notes || 'Weekly batch approval',
          },
          audit: { userId: req.session.user.id, req, details: { source: 'weekly_batch' } },
        });
        // Bump row_version separately (optimistic lock)
        await db.query('UPDATE payment_requests SET row_version = row_version + 1 WHERE id = ?', [id]);
        approvedIds.push(id);
      } catch (e) {
        if (e.code === 'INVALID_STATE_TRANSITION') { failedIds.push(id); continue; }
        throw e;
      }
    }
    res.json({ success: true, approved: approvedIds.length, approved_ids: approvedIds, skipped: failedIds });
  }));

module.exports = router;
