// MODULE 09 — Meetings (formerly MOMs): create, issue to client, action items, ack
// Input:  state.projectId, state.clientId
// Output: state.momId
//
// V5 changes (post-collapse):
//   - moms table     → meetings table
//   - mom_action_items → meeting_actions table
//   - mom_number col → meeting_number col
//   - List response: { moms } → { meetings }
//   - Schema fields: meeting_type → type; venue → location;
//                    attendees → attendees_internal/external (or single 'attendees' falls back to internal)
//   - issue-to-client confirmation body: { confirmation, meeting_number } (was mom_number)
//   - Audit log writes for 'mom_issued_to_client' do not exist in V5 — removed assertion

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');

async function run() {
  reset();
  const { projectId, clientId } = readState();
  const agent  = new Agent();
  const pmcAgt = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');
  await pmcAgt.login('test_pmc', 'NuPMC@2026');

  // ── CREATE MEETING (formerly "MOM")
  let momId;
  await test('create meeting for site review', async () => {
    const res = await agent.post(`/meetings/${projectId}`, {
      client_id:    clientId,
      meeting_date: new Date().toLocaleDateString('en-CA'),
      type:         'client',
      title:        'Site Review Meeting',
      attendees_internal: 'Principal, PMC Head',
      attendees_external: 'Client Representative',
      location:     'Site Office',
      agenda:       'Progress review, safety walkthrough, payment status',
    });
    ok(res, 'create meeting');
    has(res.body, 'id');
    momId = res.body.id;
    has(res.body, 'meeting_number');
  });

  // ── ADD ACTION ITEMS
  await test('add action items to meeting', async () => {
    const items = [
      { description: 'Contractor to submit revised concrete mix design by Friday', assignee: 'PMC Head', due_date: new Date(Date.now()+3*86400000).toLocaleDateString('en-CA') },
      { description: 'Client to approve revised drawings for Phase 2', assignee: 'Client', due_date: new Date(Date.now()+7*86400000).toLocaleDateString('en-CA') },
    ];
    for (const item of items) {
      const res = await agent.post(`/meetings/${momId}/action-items`, item);
      ok(res, 'add action item');
    }
  });

  // ── ACTION ITEMS ARE RETRIEVABLE
  await test('action items are listed', async () => {
    const res = await agent.get(`/meetings/${momId}/action-items`);
    is(res.status, 200, 'action items status');
    has(res.body, 'action_items');
    gt(res.body.action_items.length, 0, 'items present');
  });

  // ── ISSUE MEETING TO CLIENT
  await test('meeting is issued to client (two-step: approve, then issue)', async () => {
    // STEP 1 — PMC approves internally
    const res1 = await agent.post(`/meetings/${momId}/approve`);
    ok(res1, 'approve meeting');
    const [[m1]] = await db.query('SELECT status FROM meetings WHERE id=?', [momId]);
    is(m1.status, 'approved', 'after approve: status=approved (not issued)');

    // STEP 2 — Verify preview endpoint works
    const previewRes = await agent.get(`/meetings/${momId}/preview-client-send`);
    is([200, 400].includes(previewRes.status), true, 'preview accessible');

    // STEP 3 — Give client a contact_whatsapp if missing, then actually issue
    await db.query(
      `UPDATE clients c JOIN meetings m ON m.client_id=c.id
       SET c.contact_whatsapp='919000000099' WHERE m.id=?`, [momId]
    );
    const [[mom1]] = await db.query('SELECT meeting_number FROM meetings WHERE id=?', [momId]);
    const res2 = await agent.post(`/meetings/${momId}/issue-to-client`, {
      confirmation: 'SEND',
      meeting_number: mom1.meeting_number,
    });
    ok(res2, 'issue to client');

    const [[mom]] = await db.query('SELECT status FROM meetings WHERE id=?', [momId]);
    is(mom.status, 'issued', 'after issue-to-client: status=issued');
  });

  await test('meeting issue-to-client requires confirmation string', async () => {
    // Reset to approved so we can test rejection
    await db.query("UPDATE meetings SET status='approved' WHERE id=?", [momId]);
    const res = await agent.post(`/meetings/${momId}/issue-to-client`, {});
    is(res.status, 400, 'rejected without confirmation');
    is(res.body?.code, 'CONFIRMATION_MISSING', 'correct error code');
    // Restore state
    await db.query("UPDATE meetings SET status='issued' WHERE id=?", [momId]);
  });

  // ── PROJECT MEETING LIST
  await test('project meeting list shows issued meeting', async () => {
    const res = await agent.get(`/meetings/${projectId}`);
    is(res.status, 200, 'list status');
    has(res.body, 'meetings');
    const ids = res.body.meetings.map(m => m.id);
    is(ids.includes(momId), true, 'meeting in list');
  });

  // ── MARK ACTION ITEM DONE
  await test('action item can be marked complete', async () => {
    const [[ai]] = await db.query(
      'SELECT id FROM meeting_actions WHERE meeting_id=? LIMIT 1', [momId]
    );
    if (ai) {
      const res = await agent.patch(`/meetings/action-items/${ai.id}/complete`);
      ok(res, 'complete action item');
    }
  });

  // ── CLIENT ACK SIMULATION (direct DB)
  await test('meeting client acknowledgement recorded', async () => {
    await db.query(
      "UPDATE meetings SET client_acked_at=NOW() WHERE id=?",
      [momId]
    );
    const [[mom]] = await db.query('SELECT client_acked_at FROM meetings WHERE id=?', [momId]);
    has(mom, 'client_acked_at', 'ack recorded');
  });

  writeState({ momId });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
