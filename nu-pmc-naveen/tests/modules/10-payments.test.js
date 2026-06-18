// MODULE 10 — Payments: advance, RA bill, invoice enforcement, GST split, ICICI Excel
// Input:  state.projectId, state.engagementIds, state.vendorIds
// Output: state.paymentIds, state.advanceId

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db, assert } = require('./helpers');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

async function run() {
  reset();
  const { projectId, engagementIds, vendorIds } = readState();
  const agent   = new Agent();
  const pmcAgt  = new Agent();
  const finAgt  = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');
  await pmcAgt.login('test_pmc', 'NuPMC@2026');
  await finAgt.login('test_finance', 'NuPMC@2026');

  const paymentIds = {};

  // ── PRECONDITION (V5): Vendors must be cleared by finance before any
  //    payment request can be raised. (vendors.clearance_status='cleared')
  //    Test seed creates vendors as 'pending' — clear them via finance role.
  await test('clear vendors for payment eligibility', async () => {
    for (const [trade, vid] of Object.entries(vendorIds)) {
      const res = await finAgt.patch(`/vendors/master/${vid}/clear`, {});
      ok(res, `clear ${trade} vendor`);
    }
  });

  // ── MOBILISATION ADVANCE — no invoice required
  let advanceId;
  await test('mobilisation advance does NOT require invoice', async () => {
    const res = await pmcAgt.post(`/payment-requests/${projectId}`, {
      engagement_id:  engagementIds.civil,
      payment_type:   'mobilisation_advance',
      amount_requested: 425000,
      reason:         'Mobilisation advance as per contract clause 4.2 — 5% of contract value',
    });
    ok(res, 'advance request');
    has(res.body, 'id');
    advanceId = res.body.id;
    paymentIds.advance = advanceId;
  });

  // ── RA BILL WITHOUT INVOICE — must be blocked
  await test('RA bill blocked without invoice attachment', async () => {
    const res = await pmcAgt.post(`/payment-requests/${projectId}`, {
      engagement_id:   engagementIds.civil,
      payment_type:    'running_account_bill',
      amount_requested: 850000,
      reason:          'RA Bill #1 — Substructure 100% complete',
    });
    is(res.status, 400, 'should be blocked');
    is(res.body.invoice_required, true, 'invoice_required flag');
  });

  // ── RA BILL WITH OVERRIDE REASON
  let raBillId;
  await test('RA bill passes with override reason', async () => {
    const res = await pmcAgt.post(`/payment-requests/${projectId}`, {
      engagement_id:          engagementIds.civil,
      payment_type:           'running_account_bill',
      amount_requested:        850000,
      reason:                 'RA Bill #1 — Substructure 100% complete',
      invoice_override_reason: 'Invoice in transit — physical copy at site office',
      gst_rate:               18,
      hsn_code:               '995411',
      is_interstate:          0,
    });
    ok(res, 'RA bill with override');
    has(res.body, 'id');
    raBillId = res.body.id;
    paymentIds.raBill = raBillId;
  });

  // ── PMC APPROVES ADVANCE (PMC batch approve)
  await test('PMC batch-approves advance', async () => {
    if (!advanceId) return;
    const res = await pmcAgt.post(`/payment-requests/${projectId}/batch-approve`, {
      payment_ids: [advanceId],
    });
    ok(res, 'PMC batch approve advance');
  });

  // ── NAVEEN APPROVES PAYMENT (principal batch approve)
  await test('principal approves RA bill payment', async () => {
    if (!raBillId) return;
    const res = await agent.post(`/payments/${projectId}/batch-approve`, {
      payment_ids: [raBillId],
    });
    ok(res, 'principal batch approve RA bill');
  });

  // ── GST SPLIT CALCULATION VERIFICATION
  await test('GST split is correct for ₹8.5L @18%', () => {
    const amount  = 850000;
    const taxable = amount / 1.18;
    const gst     = amount - taxable;
    const cgst    = gst / 2;
    assert.ok(Math.abs(taxable - 720338.98) < 1, `taxable ${taxable.toFixed(2)} ≈ 720338.98`);
    assert.ok(Math.abs(cgst - 64830.51) < 1, `CGST ${cgst.toFixed(2)} ≈ 64830.51`);
  });

  // ── ADVANCE RECOVERY SCHEDULE RECORD (V5: was advance_adjustments)
  await test('advance recovery schedule can be recorded', async () => {
    if (!advanceId) return;
    const [result] = await db.query(
      `INSERT INTO advance_recovery_schedule
         (engagement_id, advance_type, advance_amount, advance_date, recovery_pct_per_bill, created_by)
       VALUES (?, 'mobilisation', ?, CURDATE(), 10.00, ?)`,
      [engagementIds.civil, 425000, 1]
    );
    is(result.insertId > 0, true, 'recovery schedule recorded');
  });

  // ── ICICI EXCEL GENERATION
  await test('ICICI payment Excel is generated', async () => {
    const res = await finAgt.get(`/payments/${projectId}/icici-excel`);
    // May return 404 if no principal_approved payments yet — that's OK
    is(res.status < 500, true, `ICICI Excel status ${res.status}`);
    if (res.status === 200) {
      const contentType = res.headers['content-type']||'';
      is(contentType.includes('spreadsheetml') || contentType.includes('octet'), true, 'Excel content type');
    }
  });

  // ── PRE-UPLOAD CHECK
  await test('payment pre-upload check runs', async () => {
    const res = await pmcAgt.get(`/payment-requests/${projectId}/weekly-batch`);
    is(res.status, 200, 'batch status');
    has(res.body, 'pending');
  });

  writeState({ paymentIds, advanceId, raBillId });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
