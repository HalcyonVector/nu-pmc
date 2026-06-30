// routes/urgent-payments.js
// ============================================================
// URGENT FAST-PATH PAYMENT LANE
//
// Use case: "Boy is standing at the shop to buy a tap and needs to pay
// immediately." Vendor may not even exist in the vendor master yet, but
// the spend must still be documented. PMC auto-approves up to a threshold;
// principal review only after-the-fact.
//
// nu PMC has TWO payment lanes by design (NOT a duplication; healthy split):
//
//   1. modules/finance/routes/payment-requests.js — STANDARD lane. Full
//      vendor master, full approval chain, ICICI bulk export.
//
//   2. THIS FILE — fast-path lane. No-vendor-master allowed; immediate cash;
//      principal review is reconciliation, not gate.
//
// Different state machines on the same outcome ("vendor gets paid"). DO NOT MERGE.
// ============================================================
const express  = require('express');
const multer   = require('multer');
const db       = require('../../../middleware/db');
const users = require('../../../services/users-lookup');
const { requireAuth, requirePMC, requirePrincipal, requireRole, requireProjectScope } = require('../../../middleware/auth');
const { decodeUPIQR } = require('../../../services/upi-qr');
const notif    = require('../../../services/notifications');
const asyncHandler = require('../../../middleware/asyncHandler');
const audit = require('../../../services/audit');
const router   = express.Router();

const upload = multer({ dest: 'uploads/urgent-payments/' });

// Roles that may raise an urgent payment OR view urgent payments on a project.
// Site managers (both grades) can raise because urgent requests often originate
// at site. Pmc/principals retain raise-rights for the same reason.
const URGENT_PAYMENT_ROLES = [
  'site_manager','senior_site_manager','pmc_head','principal','design_principal','finance_admin',
];

function validateDocs(body, files, isAdhoc, amount) {
  const errors = [];
  const fileKeys = (files||[]).map(f => f.fieldname);
  if (!fileKeys.includes('invoice')) errors.push('Invoice photo required');
  if (isAdhoc) {
    if (!body.adhoc_name)  errors.push('Shop owner name required');
    if (!body.adhoc_phone) errors.push('Shop owner phone required');
    const hasBankDetails = body.adhoc_bank_account && body.adhoc_bank_ifsc;
    const hasUPI         = fileKeys.includes('upi_qr') || body.adhoc_upi_id;
    if (!hasBankDetails && !hasUPI) errors.push('Bank account+IFSC or UPI QR required');
    if (parseFloat(amount) > 10000 && !body.adhoc_gstin && !body.adhoc_pan) {
      errors.push('GST or PAN required for payments above Rs 10,000');
    }
  }
  return errors;
}

async function getApprovalChain(isAdhoc, amount, projectId) {
  const [[proj]] = await db.query(
    'SELECT COALESCE(SUM(sanctioned),0) AS total FROM budget_cost_heads WHERE project_id=? AND status=?',
    [projectId, 'approved']
  );
  const threshold = parseFloat(proj?.total || 0) * 0.0025;
  const isAbove   = parseFloat(amount) > threshold;
  if (isAdhoc) return isAbove ? ['pmc','principal','finance_admin'] : ['pmc','finance_admin'];
  return isAbove ? ['pmc','principal','finance_admin'] : ['auto','finance_admin'];
}

// POST /api/urgent-payments/:project_id — raise urgent payment
router.post('/:project_id',
  requireAuth,
  requireRole(...URGENT_PAYMENT_ROLES),
  requireProjectScope(),
  upload.fields([{ name:'invoice', maxCount:1 }, { name:'upi_qr', maxCount:1 }]),
  async (req, res) => {
    try {
      const me      = req.session.user;

      const { UrgentPayment, parseOr400 } = require('../../../services/schemas');
      // Name it 'input' — 'body' is used below for WhatsApp message text
      const input = parseOr400(UrgentPayment, req, res);
      if (!input) return;

      const isAdhoc     = input.is_adhoc || !input.vendor_id;
      const files       = Object.values(req.files||{}).flat();
      const validAmount = input.amount;

      const docErrors = validateDocs(req.body, files, isAdhoc, validAmount);
      if (docErrors.length) return res.status(400).json({ error: docErrors.join('. ') });

      let lane = 'bank', upiId = input.adhoc_upi_id, upiPath = null;
      if (req.files?.upi_qr?.[0]) {
        lane    = 'upi';
        upiPath = req.files.upi_qr[0].path;
        const qrResult = await decodeUPIQR(upiPath);
        if (!qrResult.valid) return res.status(400).json({ error: 'Could not read UPI QR: ' + qrResult.error });
        upiId = qrResult.upi_id;
      } else if (input.adhoc_upi_id) {
        lane = 'upi';
      }

      const invoicePath = req.files?.invoice?.[0]?.path || null;
      const chain       = await getApprovalChain(isAdhoc, validAmount, req.params.project_id);
      const initialStatus = chain[0] === 'auto' ? 'pmc_approved' : 'pending_pmc';

      // Insert into payment_requests with is_urgent=1
      const [result] = await db.query(
        `INSERT INTO payment_requests
         (project_id, vendor_id, requested_by, amount_requested, reason, payment_type,
          is_urgent, is_adhoc, adhoc_name, adhoc_phone, adhoc_gstin, adhoc_pan,
          adhoc_bank_account, adhoc_bank_ifsc, adhoc_upi_id, adhoc_upi_qr_path,
          payment_lane, status)
         VALUES (?,?,?,?,?,'other',1,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.params.project_id, input.vendor_id, me.id, validAmount, input.reason,
         isAdhoc?1:0, input.adhoc_name, input.adhoc_phone, input.adhoc_gstin, input.adhoc_pan,
         input.adhoc_bank_account, input.adhoc_bank_ifsc, upiId, upiPath,
         lane, initialStatus]
      );

      // Save invoice evidence
      if (invoicePath) {
        await db.query(
          'INSERT INTO payment_request_evidence (payment_request_id, file_path, file_type, uploaded_by) VALUES (?,?,?,?)',
          [result.insertId, invoicePath, 'photo', me.id]
        );
      }

      const proj = { name: await users.projectName(req.params.project_id) };

      const pwaUrl = `${process.env.PWA_BASE_URL}/app/urgent-payments/${result.insertId}`;
      const matrixAdapter = require('../../../services/matrix-adapter');
      const projectRoom = await matrixAdapter.getProjectRoomId(req.params.project_id, 'internal');

      if (chain[0] === 'auto') {
        await notif.notifyUrgentPaymentAuto(input.adhoc_name || 'Known vendor', validAmount, pwaUrl);
        if (projectRoom) {
          const content = matrixAdapter.formatMessage('💰', proj?.name || '', `Urgent payment ready — ${input.adhoc_name||'Known vendor'} ₹${validAmount.toLocaleString('en-IN')}`, 'link', pwaUrl);
          await matrixAdapter.sendText({ roomId: projectRoom, body: content.body }).catch(e => console.warn('[urgent-payments] Matrix post failed:', e.message));
        }
      } else {
        const Auth = require('../../auth/contract');
        const pmcHeads = await Auth.functions.getPmcHeadsForProject(req.params.project_id);
        for (const pmc of pmcHeads) {
          await notif.notify(pmc.id, 'urgent_payment',
            `Urgent payment approval needed — ${input.adhoc_name || 'Known vendor'} ₹${validAmount.toLocaleString('en-IN')}`);
        }
        if (projectRoom) {
          const content = matrixAdapter.formatMessage('💰', proj?.name || '', `Urgent payment approval needed — ${input.adhoc_name||'Known vendor'} ₹${validAmount.toLocaleString('en-IN')}`, 'link', pwaUrl);
          await matrixAdapter.sendText({ roomId: projectRoom, body: content.body }).catch(e => console.warn('[urgent-payments] Matrix post failed:', e.message));
        }
      }

      audit.log({ userId: me.id, action: 'urgent_payment.raise',
        entityType: 'payment_requests', entityId: result.insertId,
        details: { project_id: parseInt(req.params.project_id, 10), vendor_id: input.vendor_id || null, is_adhoc: isAdhoc, amount: validAmount, payment_lane: lane, upi_id: upiId || null, initial_status: initialStatus, approval_chain: chain, reason: input.reason }, req });

      res.json({ success: true, id: result.insertId, chain, payment_lane: lane, upi_id: upiId||null,
        message: chain[0]==='auto' ? 'Auto-approved — Finance Admin notified.' : 'PMC Head notified for approval.' });
    } catch (err) {
      console.error('[UrgentPay]', err.message);
      res.status(500).json({ error: 'Failed to raise urgent payment' });
    }
  }
);

// GET /api/urgent-payments/:project_id — list urgent payments
router.get('/:project_id',
  requireAuth,
  requireRole(...URGENT_PAYMENT_ROLES),
  requireProjectScope(),
  asyncHandler(async (req, res) => {
    const [payments] = await db.query(
      `SELECT * FROM payment_requests
       WHERE project_id=? AND is_urgent=1 ORDER BY raised_at DESC`,
      [req.params.project_id]
    );
    const Onboarding = require('../../onboarding/contract');
    const vendors = await Onboarding.functions.getVendorsByIds(payments.map(p => p.vendor_id));
    const fileUrls = require('../../../services/file-url');
    if (payments.length) {
      const prIds = payments.map(p => p.id);
      const [evRows] = await db.query(
        `SELECT payment_request_id, file_path, file_type FROM payment_request_evidence WHERE payment_request_id IN (?)`,
        [prIds]
      );
      const evMap = {};
      evRows.forEach(e => {
        if (!evMap[e.payment_request_id]) evMap[e.payment_request_id] = [];
        evMap[e.payment_request_id].push({ url: fileUrls.fileUrl(e.file_path), type: e.file_type, name: (e.file_path||'').split('/').pop() });
      });
      payments.forEach(p => {
        p.vendor_name    = vendors.get(p.vendor_id)?.vendor_name || null;
        p.evidence_files = evMap[p.id] || [];
      });
    } else {
      payments.forEach(p => { p.vendor_name = vendors.get(p.vendor_id)?.vendor_name || null; });
    }
    res.json({ payments });
  }));

module.exports = router;
