// MODULE 91 — Optimistic locking: concurrent edits must not silently overwrite
const { test, summary, reset, readState, Agent, ok, is, has, gt, db } = require('./helpers');

async function run() {
  reset();
  const agent = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');

  // Seed minimal data — client, project, vendor, engagement, payment request
  const [[principal]] = await db.query("SELECT id FROM users WHERE username='test_principal'");
  const [c] = await db.query(
    `INSERT INTO clients (client_name, display_name, gstin, state_name, state_code, tally_party_ledger, created_by)
     VALUES ('OL Test Client','OL','29TESTC1234A1Z5','Karnataka',29,'OL Test',?)`, [principal.id]
  );
  const [p] = await db.query(
    `INSERT INTO projects (code, name, client, client_id, location, project_type, r0_start_date, r0_end_date, created_by, entity_id)
     VALUES ('OL-TEST','OL Test Project','OL','`+c.insertId+`','Bengaluru','commercial','2026-01-01','2026-06-30',?,2)`, [principal.id]
  );
  const [v] = await db.query(
    `INSERT INTO vendors (trade, vendor_name, bank_account, bank_ifsc, registered_by)
     VALUES ('Civil','OL Vendor','111222333','HDFC0001234',?)`, [principal.id]
  );
  const [e] = await db.query(
    `INSERT INTO vendor_engagements (vendor_id, project_id, scope, contract_value, engaged_by)
     VALUES (?,?,?,?,?)`,
    [v.insertId, p.insertId, 'Test scope', 1000000, principal.id]
  );
  const [pr] = await db.query(
    `INSERT INTO payment_requests (project_id, vendor_id, engagement_id, amount_requested, reason, payment_type, requested_by, status)
     VALUES (?,?,?,?,?,?,?,'pending_pmc')`,
    [p.insertId, v.insertId, e.insertId, 50000, 'Test advance', 'mobilisation_advance', principal.id]
  );
  const prId = pr.insertId;

  // Test 1: Matching version succeeds
  await test('optimistic lock: matching version succeeds', async () => {
    const [[row]] = await db.query('SELECT row_version FROM payment_requests WHERE id=?', [prId]);
    const res = await agent.post(`/payment-requests/${p.insertId}/batch-approve`, {
      ids: [prId],
      row_versions: { [prId]: row.row_version },
      notes: 'Approved with matching version'
    });
    is(res.status, 200, 'matching version 200');
  });

  // Reset for next test
  await db.query("UPDATE payment_requests SET status='pending_pmc', row_version=1 WHERE id=?", [prId]);

  // Test 2: Stale version fails with 409
  await test('optimistic lock: stale version returns 409', async () => {
    const res = await agent.post(`/payment-requests/${p.insertId}/batch-approve`, {
      ids: [prId],
      row_versions: { [prId]: 999 },   // intentionally wrong
      notes: 'Should fail'
    });
    console.log('FULL response:', res.status, JSON.stringify(res.body));
    is(res.status, 409, 'stale version 409');
  });

  // Test 3: Missing version is accepted (backwards compatibility)
  await test('optimistic lock: missing row_versions is accepted (legacy clients)', async () => {
    const res = await agent.post(`/payment-requests/${p.insertId}/batch-approve`, {
      ids: [prId],
      notes: 'No version check'
    });
    is(res.status, 200, 'legacy accepted');
  });

  // Cleanup
  await test('cleanup OL test data', async () => {
    await db.query('SET FOREIGN_KEY_CHECKS=0');
    await db.query('DELETE FROM payment_requests WHERE id=?', [prId]);
    await db.query('DELETE FROM vendor_engagements WHERE id=?', [e.insertId]);
    await db.query('DELETE FROM vendors WHERE id=?', [v.insertId]);
    await db.query('DELETE FROM projects WHERE id=?', [p.insertId]);
    await db.query('DELETE FROM clients WHERE id=?', [c.insertId]);
    await db.query('SET FOREIGN_KEY_CHECKS=1');
  });

  return summary();
}

module.exports = { run };
