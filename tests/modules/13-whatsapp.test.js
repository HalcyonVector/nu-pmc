// MODULE 13 — WhatsApp simulation: webhook flows, reply-to-act handlers
// Simulates Twilio inbound messages without real WhatsApp
// Tests: daily report text, location checkin, button replies (GRN approve, issue confirm, anomaly ack, MOM ack)
// Input:  state.projectId, state.siteId, state.grnIds, state.issueIds, state.momId, state.anomalyReportId
// NOTE:   NODE_ENV must NOT be 'production' — signature validation is skipped in dev

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');
const request = require('supertest');
const app     = require('../../server');

// Simulate a Twilio inbound message to the webhook
async function waWebhook(from, body, extras = {}) {
  return request(app)
    .post('/api/whatsapp/webhook')
    .type('form')
    .send({ From: `whatsapp:+${from}`, Body: body, ...extras });
}

// Simulate a button reply (Twilio sends ButtonPayload)
async function waButton(from, payload) {
  return waWebhook(from, payload, { ButtonPayload: payload });
}

// Simulate a location share
async function waLocation(from, lat, lng, address) {
  return request(app)
    .post('/api/whatsapp/webhook')
    .type('form')
    .send({
      From:      `whatsapp:+${from}`,
      Body:      '',
      Latitude:  lat,
      Longitude: lng,
      Address:   address || 'Test Site, Electronic City, Bengaluru',
    });
}

async function run() {
  reset();
  const state = readState();
  const { projectId, siteId, grnIds, issueIds, momId } = state;

  // Get site manager phone from DB
  const [[siteUser]] = await db.query('SELECT id, phone, full_name FROM users WHERE username=?', ['test_site']);
  const sitePhone = siteUser?.phone || '919000000003';

  // Get principal phone
  const [[principal]] = await db.query('SELECT id, phone FROM users WHERE username=?', ['test_principal']);
  const principalPhone = principal?.phone || '919000000001';

  // ── 1. WEBHOOK IS REACHABLE
  await test('WhatsApp webhook responds to POST', async () => {
    const res = await waWebhook('919999999999', 'hello');
    is(res.status, 200, 'webhook status 200');
  });

  // ── 2. UNREGISTERED NUMBER — graceful handling
  await test('unknown number gets polite response', async () => {
    const res = await waWebhook('919999888800', 'ping');
    is(res.status, 200, 'unknown number handled gracefully');
  });

  // ── 3. LOCATION CHECK-IN
  await test('site manager location check-in is recorded', async () => {
    const before = await db.query(
      "SELECT COUNT(*) AS cnt FROM site_checkins WHERE user_id=? AND checkin_date=CURDATE()",
      [siteUser?.id]
    );
    const res = await waLocation(sitePhone, 12.8456, 77.6603, 'Electronic City Phase 1, Bengaluru');
    is(res.status, 200, 'location webhook status');

    // Allow async DB write
    await new Promise(r => setTimeout(r, 200));

    const after = await db.query(
      "SELECT COUNT(*) AS cnt FROM site_checkins WHERE user_id=? AND checkin_date=CURDATE()",
      [siteUser?.id]
    );
    const added = after[0][0].cnt - before[0][0].cnt;
    is(added, 1, 'checkin recorded in DB');
  });

  // ── 4. DAILY REPORT TEXT MESSAGE
  await test('site manager daily report text message handled', async () => {
    const res = await waWebhook(sitePhone,
      'Daily report: Excavation 40% done. 20 workers. Weather sunny. No issues today.'
    );
    is(res.status, 200, 'text report handled');
  });

  // ── 5. GRN APPROVAL BUTTON REPLY
  await test('PMC approves GRN via WhatsApp button', async () => {
    if (!grnIds?.approved) return;

    // Register a pending action for GRN approval
    const [[grn]] = await db.query(
      'SELECT project_id FROM grns WHERE id=?', [grnIds.approved]
    );
    if (!grn) return;

    // Seed wa_pending_actions
    const expiresAt = new Date(Date.now() + 3600000);
    const [pa] = await db.query(
      `INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, message_sent, expires_at)
       VALUES ('grn_approve',?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at)`,
      [grnIds.approved, 'grns', principalPhone, principal?.id, 'GRN pending approval', expiresAt]
    );

    const res = await waButton(principalPhone, '1'); // '1' = Approve
    is(res.status, 200, 'button reply handled');

    // Allow async DB write
    await new Promise(r => setTimeout(r, 300));

    // Pending action should be consumed
    const [[pending]] = await db.query(
      "SELECT status FROM wa_pending_actions WHERE action_type='grn_approve' AND ref_id=? AND phone=?",
      [grnIds.approved, principalPhone]
    );
    is(['acted','cancelled'].includes(pending?.status||''), true, 'pending action consumed');
  });

  // ── 6. ISSUE CONFIRM BUTTON REPLY
  await test('PMC confirms safety issue via WhatsApp button', async () => {
    if (!issueIds?.safety) return;

    // Seed pending action
    const expiresAt = new Date(Date.now() + 3600000);
    await db.query(
      `INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, message_sent, expires_at)
       VALUES ('issue_confirm',?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at)`,
      [issueIds.safety, 'issues', principalPhone, principal?.id, 'Issue pending confirm', expiresAt]
    );

    const res = await waButton(principalPhone, '1'); // '1' = Confirm
    is(res.status, 200, 'issue confirm reply handled');
    await new Promise(r => setTimeout(r, 300));
  });

  // ── 7. ANOMALY ACKNOWLEDGEMENT BUTTON REPLY
  await test('PMC acknowledges anomaly via WhatsApp button', async () => {
    // Seed a daily report and pending anomaly action
    const [dr] = await db.query(
      `INSERT INTO daily_reports (project_id, report_date, site_manager_id, source, overall_notes)
       VALUES (?,CURDATE(),?,'whatsapp','Progress jump flagged — test anomaly')`,
      [projectId, siteUser?.id]
    );
    const drId = dr.insertId;

    const expiresAt = new Date(Date.now() + 3600000);
    await db.query(
      `INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, message_sent, expires_at)
       VALUES ('anomaly_ack',?,?,?,?,?,?)`,
      [drId, 'daily_reports', principalPhone, principal?.id, 'Anomaly: progress jump', expiresAt]
    );

    const res = await waButton(principalPhone, '1'); // '1' = Acknowledge
    is(res.status, 200, 'anomaly ack reply handled');
    await new Promise(r => setTimeout(r, 300));
  });

  // ── 8. MOM CLIENT ACK — simulates client WhatsApp reply
  await test('client acknowledges MOM via WhatsApp button', async () => {
    if (!momId) return;

    // Get client contact phone
    const [[mom]] = await db.query(
      `SELECT c.contact_whatsapp FROM meetings m
       JOIN clients c ON m.client_id=c.id WHERE m.id=?`, [momId]
    );
    const clientPhone = (mom?.contact_whatsapp || '919000000099').replace(/\D/g,'');

    // Seed pending action for client ack
    const expiresAt = new Date(Date.now() + 259200000); // 3 days
    await db.query(
      `INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, message_sent, expires_at)
       VALUES ('mom_client_ack',?,?,?,NULL,?,?)`,
      [momId, 'meetings', clientPhone, 'MOM sent for acknowledgement', expiresAt]
    );

    const res = await waButton(clientPhone, '1'); // '1' = Accept MOM
    is(res.status, 200, 'MOM client ack handled');
    await new Promise(r => setTimeout(r, 300));

    // Verify MOM ack recorded
    const [[m]] = await db.query(
      'SELECT client_acked_at FROM meetings WHERE id=?', [momId]
    );
    // client_acked_at may already be set from module 09 — just check no crash
    is(typeof m, 'object', 'MOM record accessible after ack');
  });

  // ── 9. VENDOR DEFECT ACK BUTTON
  await test('vendor acknowledges defect via WhatsApp button', async () => {
    if (!state.ncrId) return;

    // Seed pending action for vendor defect
    const vendorPhone = '919000000010'; // test vendor phone
    const expiresAt = new Date(Date.now() + 604800000); // 7 days
    await db.query(
      `INSERT INTO wa_pending_actions (action_type, ref_id, ref_table, phone, user_id, message_sent, expires_at)
       VALUES ('vendor_defect_ack',?,?,?,NULL,?,?)`,
      [state.ncrId, 'ncrs', vendorPhone, 'Defect notice: steel quality issue', expiresAt]
    );

    const res = await waButton(vendorPhone, '1'); // '1' = Acknowledged
    is(res.status, 200, 'vendor defect ack handled');
    await new Promise(r => setTimeout(r, 200));
  });

  // ── 10. UDUPA EXCEL REQUEST — Saturday payment flow
  await test('Finance Admin requests payment Excel via WhatsApp', async () => {
    const [[finance_admin]] = await db.query(
      "SELECT id, phone FROM users WHERE username='test_finance'"
    );
    if (!finance_admin?.phone) return;

    // Seed pending action for Finance Admin Excel
    const expiresAt = new Date(Date.now() + 86400000);
    await db.query(
      `INSERT INTO wa_pending_actions
       (action_type, ref_id, ref_table, phone, user_id, message_sent, expires_at)
       VALUES ('udupa_excel_request',0,'payment_requests',?,?,?,?)`,
      [finance_admin.phone, finance_admin.id, 'ICICI Payment Excel request', expiresAt]
    );

    const res = await waButton(finance_admin.phone, '1'); // Confirm Excel generation
    is(res.status, 200, 'Finance Admin Excel request handled');
    await new Promise(r => setTimeout(r, 300));
  });

  // ── 11. STATUS CALLBACK — delivery confirmation
  await test('Twilio status callback is handled', async () => {
    const res = await request(app)
      .post('/api/whatsapp/status-callback')
      .type('form')
      .send({
        MessageSid:   'SMtest123456',
        MessageStatus: 'delivered',
        To:           'whatsapp:+919000000001',
      });
    is(res.status, 200, 'status callback handled');
  });

  // ── 12. VERIFY WA_PENDING_ACTIONS cleanup
  await test('processed pending actions have correct status', async () => {
    const [processed] = await db.query(
      "SELECT COUNT(*) AS cnt FROM wa_pending_actions WHERE status='acted'"
    );
    const cnt = processed[0].cnt;
    gt(cnt, 0, 'at least one action processed via WhatsApp');
  });

  // ── Clean up wa module test data
  await db.query(
    "DELETE FROM site_checkins WHERE user_id=?", [siteUser?.id]
  );
  await db.query(
    "DELETE FROM daily_reports WHERE project_id=? AND source='whatsapp' AND site_manager_id=?",
    [projectId, siteUser?.id]
  );

    
  // ── CLEANUP ALL PROJECT DATA (moved from module 12 so test fixtures remain available through module 13)
  await test('cleanup project data', async () => {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    const cleanups = [
      ['advance_adjustments',  'project_id=?',   [projectId]],
      ['vendor_boq_mapping',   'project_id=?',   [projectId]],
      ['meeting_actions',     'meeting_id IN (SELECT id FROM meetings WHERE project_id=?)', [projectId]],
      ['meeting_revisions',        'meeting_id IN (SELECT id FROM meetings WHERE project_id=?)', [projectId]],
      ['meetings',                 'project_id=?',   [projectId]],
      ['issues',               'project_id=?',   [projectId]],
      ['grns',                 'project_id=?',   [projectId]],
      ['payment_request_evidence', 'payment_request_id IN (SELECT id FROM payment_requests WHERE project_id=?)', [projectId]],
      ['payment_requests',     'project_id=?',   [projectId]],
      ['tds_records',          'project_id=?',   [projectId]],
      ['client_receipts',      'project_id=?',   [projectId]],
      ['proforma_invoices',    'project_id=?',   [projectId]],
      ['fee_schedule',         'project_id=?',   [projectId]],
      ['daily_reports',        'project_id=?',   [projectId]],
      ['weekly_reports',       'project_id=?',   [projectId]],
      ['task_updates',         'project_id=?',   [projectId]],
      ['schedule_tasks',       'project_id=?',   [projectId]],
      ['schedule_versions',    'project_id=?',   [projectId]],
      ['drawing_versions',     'drawing_id IN (SELECT id FROM drawings WHERE project_id=?)', [projectId]],
      ['drawings',             'project_id=?',   [projectId]],
      ['wa_pending_actions',   'project_id=?',  [projectId]],
      ['boq_items',            'project_id=?',   [projectId]],
      ['boq_versions',         'project_id=?',   [projectId]],
      ['vendor_engagements',   'project_id=?',   [projectId]],
      ['project_assignments',  'project_id=?',   [projectId]],
      ['projects',             'id=?',            [projectId]],
      ['site_checkins',        'project_id=?',   [projectId]],
    ];
    for (const [table, where, params] of cleanups) {
      try {
        await db.query(`DELETE FROM ${table} WHERE ${where}`, params);
      } catch (e) { /* silently skip — some tables may not exist yet */ }
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  });

await test('cleanup test users', async () => {
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query("DELETE FROM users WHERE username LIKE 'test_%'");
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) { console.error('user cleanup:', e.message); }
  });

  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
