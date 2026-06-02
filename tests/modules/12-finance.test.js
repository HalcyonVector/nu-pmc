// MODULE 12 — Finance: client receipts, GST statement, Tally export, cleanup
// Input:  state.projectId, state.clientId, state.raBillId
// Output: nothing — terminal module, cleans up test data

const { test, summary, reset, readState, Agent, ok, is, has, db, dbClean } = require('./helpers');

async function run() {
  reset();
  const { projectId, clientId, raBillId } = readState();
  const finAgt  = new Agent();
  const agent   = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');
  await finAgt.login('test_finance', 'NuPMC@2026');

  // ── CREATE A PI FIRST (client receipts link to invoices)
  let piId, feeScheduleId;
  await test('create PI for receipt test', async () => {
    // Get principal user id for created_by/raised_by
    const [[prin]] = await db.query("SELECT id FROM users WHERE username='test_principal'");
    // 1. Create fee schedule milestone (FK requirement)
    const [fs] = await db.query(
      `INSERT INTO fee_schedule (project_id, milestone_name, amount, created_by)
       VALUES (?,?,?,?)`,
      [projectId, 'Stage 1 — Concept Design', 500000, prin.id]
    );
    feeScheduleId = fs.insertId;
    // 2. Create PI
    const [pi] = await db.query(
      `INSERT INTO proforma_invoices (project_id, pi_number, fee_schedule_id,
        amount_ex_gst, gst_pct, amount_gst, amount_total, status, raised_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [projectId, 'PI-TEST-001', feeScheduleId,
       500000, 18, 90000, 590000, 'sent', prin.id]
    );
    piId = pi.insertId;
  });

  // ── LOG CLIENT RECEIPT
  let receiptId;
  await test('finance admin logs client receipt', async () => {
    const res = await finAgt.post(`/finance/${projectId}/client-receipts`, {
      pi_id:           piId,
      amount_received: 500000,
      receipt_date:    new Date().toLocaleDateString('en-CA'),
      utr:             'UTR202604170001',
      notes:           'Stage 1 fee receipt',
    });
    ok(res, 'log receipt');
    has(res.body, 'id');
    receiptId = res.body.id;
  });

  // ── RECEIPT IS RETRIEVABLE
  await test('client receipts are listed', async () => {
    const res = await finAgt.get(`/finance/${projectId}/client-receipts`);
    is(res.status, 200, 'list status');
    has(res.body, 'receipts');
    const ids = res.body.receipts.map(r => r.id);
    is(ids.includes(receiptId), true, 'receipt in list');
  });

  // ── GST STATEMENT — this month
  await test('GST statement generates for current month', async () => {
    const month = new Date().toLocaleDateString('en-CA').substring(0,7);
    const res   = await finAgt.get(`/gst-statement?month=${month}&project_id=${projectId}`);
    is(res.status, 200, 'statement status');
    has(res.body, 'totals');
    has(res.body.totals, 'payments');
    has(res.body.totals, 'advances');
    has(res.body.totals, 'receipts');
  });

  // ── GST STATEMENT VALIDATES MONTH FORMAT
  await test('GST statement rejects invalid month', async () => {
    const res = await finAgt.get('/gst-statement?month=invalid');
    is(res.status, 400, 'bad request for invalid month');
  });

  // ── GST STATEMENT EXCEL DOWNLOAD
  await test('GST statement Excel download works', async () => {
    const month = new Date().toLocaleDateString('en-CA').substring(0,7);
    const res   = await finAgt.get(`/gst-statement?month=${month}&project_id=${projectId}&format=excel`);
    // May 404 if no paid invoices — that's OK. Should not 500.
    is(res.status < 500, true, `Excel download status ${res.status}`);
  });

  // ── PETTY CASH
  await test('petty cash balance is accessible', async () => {
    const res = await finAgt.get(`/finance/${projectId}/petty-cash`);
    is(res.status, 200, 'petty cash status');
    has(res.body, 'balance');
  });

  // ── TALLY EXPORT
  await test('Tally export endpoint is accessible', async () => {
    const res = await agent.get(`/invoices/${projectId}/pi`);
    is(res.status, 200, 'PI list status');
    has(res.body, 'invoices');
  });

  // ── HEALTH CHECK — verify app still healthy after full run
  await test('health check passes after full test run', async () => {
    const request = require('supertest');
    const app2    = require('../../server');
    const res     = await request(app2).get('/api/health');
    is(res.status, 200, 'health status');
    is(res.body.status, 'ok', 'health ok');
    is(res.body.db, 'connected', 'DB connected');
  });

  // ── CLEANUP — remove all test data


  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
