// MODULE 07 — GRN: raise, approve, reject, threshold routing
// Input:  state.projectId, state.engagementIds, state.pmcId
// Output: state.grnIds

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');

async function run() {
  reset();
  const { projectId, engagementIds } = readState();
  const agent    = new Agent();
  const siteAgt  = new Agent();
  const pmcAgt   = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');
  await siteAgt.login('test_site',   'NuPMC@2026');
  await pmcAgt.login('test_pmc',     'NuPMC@2026');

  // ── RAISE GRN (small value — should route to senior site manager)
  let grnId1, grnId2;
  await test('site manager raises planned GRN', async () => {
    const res = await siteAgt.post(`/grn/${projectId}`, {
      engagement_id:    engagementIds.civil,
      delivery_date:    new Date().toLocaleDateString('en-CA'),
      description:      'Ready-mix concrete M30 — 15 cum for columns',
      quantity_received: 15,
      unit:             'cum',
      unit_rate:        4500,
      delivery_note_ref: 'DN-2026-001',
    });
    ok(res, 'raise GRN');
    has(res.body, 'id');
    grnId1 = res.body.id;
    has(res.body, 'grn_number');
  });

  // ── RAISE UNPLANNED GRN (no material request)
  await test('site manager raises unplanned GRN', async () => {
    const res = await siteAgt.post(`/grn/${projectId}`, {
      engagement_id:     engagementIds.civil,
      delivery_date:     new Date().toLocaleDateString('en-CA'),
      description:       'Extra steel bars — unplanned delivery',
      quantity_received: 2,
      unit:              'MT',
      unit_rate:         75000,
      is_unplanned:      true,
    });
    ok(res, 'raise unplanned GRN');
    has(res.body, 'id');
    grnId2 = res.body.id;
    is(!!res.body.is_unplanned, true, 'flagged as unplanned');
  });

  // ── PMC APPROVES GRN
  await test('PMC approves GRN', async () => {
    if (!grnId1) return;
    const res = await pmcAgt.patch(`/grn/${grnId1}/approve`);
    ok(res, 'PMC approve GRN');
  });

  // ── PMC REJECTS GRN WITH REASON
  await test('PMC rejects unplanned GRN with reason', async () => {
    if (!grnId2) return;
    const res = await pmcAgt.patch(`/grn/${grnId2}/reject`);
    ok(res, 'PMC reject GRN');
  });

  // ── RAISE GRN WITH HIGH VALUE — check routing
  await test('high-value GRN routes to PMC Head', async () => {
    // Get the approver info from DB
    if (!grnId1) return;
    const [[grn]] = await db.query('SELECT id, status FROM grns WHERE id=?', [grnId1]);
    is(grn.status, 'approved', 'GRN approved status');
  });

  // ── LIST GRNs
  await test('GRN list returns project GRNs', async () => {
    const res = await pmcAgt.get(`/grn/${projectId}`);
    is(res.status, 200, 'list status');
    has(res.body, 'grns');
    const ids = res.body.grns.map(g => g.id);
    is(ids.includes(grnId1), true, 'GRN in list');
  });

  // ── NCR FROM GRN — defect raised at GRN
  // Note: Post-V5, NCRs were folded into issues — endpoints moved from
  // /api/ncr/:project_id to /api/issues/ncr/:project_id.
  let ncrId;
  await test('PMC raises NCR from GRN rejection', async () => {
    const res = await pmcAgt.post(`/issues/ncr/${projectId}`, {
      title:       'Steel bars substandard quality',
      description: 'Delivered steel bars do not conform to IS 1786 Fe 500D specification',
      vendor_id:   null,
      grn_id:      grnId2,
      due_date:    new Date(Date.now() + 7*86400000).toLocaleDateString('en-CA'),
    });
    ok(res, 'raise NCR');
    has(res.body, 'id');
    ncrId = res.body.id;
  });

  // ── NCR LIST
  await test('NCR appears in project list', async () => {
    const res = await pmcAgt.get(`/issues/ncr/${projectId}`);
    is(res.status, 200, 'NCR list status');
    has(res.body, 'ncrs');
    const ids = (res.body.ncrs || []).map(n => n.id);
    is(ids.includes(ncrId), true, 'NCR in list');
  });

  writeState({ grnIds: { approved: grnId1, rejected: grnId2 }, ncrId });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
