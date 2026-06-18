// MODULE 06 — Drawings: upload, approve, reject, drawing queries (RFI in V5)
// Input:  state.projectId, state.siteId, state.principalId
// Output: state.drawingId, state.queryId
//
// V5 changes (post-collapse):
//   - /api/queries/* moved to /api/issues/rfi/* (drawings-linked RFIs are issues)
//   - Drawing upload now requires a drawing_register entry (gate added v5.x)
//   - Category strings are case-sensitive: 'Architectural' not 'architectural'

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');

function makePDF() {
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';
  return Buffer.from(pdf);
}

async function run() {
  reset();
  const { projectId, siteId, principalId } = readState();
  const agent = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');

  // ── SEED REGISTER ENTRY (V5 gate — main drawings must be pre-registered)
  await test('seed drawing register for A001', async () => {
    await db.query(
      `INSERT INTO drawing_register
         (project_id, drawing_number, drawing_name, category, stream, status, uploaded_by)
       VALUES (?, 'A001', 'Ground Floor Plan', 'Architectural', 'design', 'pending', ?)`,
      [projectId, principalId || 1]
    );
  });

  // ── UPLOAD DRAWING
  let drawingId, versionId;
  await test('upload drawing (PDF)', async () => {
    const buf = makePDF();
    const res = await agent.upload(
      `/drawings/${projectId}/upload`,
      'drawing', buf, 'A001_REV0_PLAN.pdf', 'application/pdf',
      { drawing_number: 'A001', drawing_name: 'Ground Floor Plan', category: 'Architectural' }
    );
    is(res.status < 400, true, `upload status ${res.status}: ${JSON.stringify(res.body).slice(0,150)}`);
    has(res.body, 'drawing_id');
    drawingId = res.body.drawing_id;
    versionId = res.body.version_id;
  });

  // ── GET DRAWINGS LIST
  await test('drawings list contains uploaded drawing', async () => {
    const res = await agent.get(`/drawings/${projectId}`);
    is(res.status, 200, 'list status');
    has(res.body, 'drawings');
    const ids = res.body.drawings.map(d => d.id);
    is(ids.includes(drawingId), true, 'drawing in list');
  });

  // ── APPROVE DRAWING (principal role)
  await test('principal approves drawing', async () => {
    if (!versionId) return;
    const res = await agent.post(`/drawings/version/${versionId}/approve`);
    ok(res, 'approve drawing');
  });

  // ── SITE MANAGER RAISES DRAWING-LINKED RFI (post-V5: was /api/queries)
  let rfiId;
  await test('site manager raises drawing RFI', async () => {
    const siteAgent = new Agent();
    await siteAgent.login('test_site', 'NuPMC@2026');
    const res = await siteAgent.post(`/issues/rfi/${projectId}`, {
      drawing_version_id: versionId,
      question:    'What is the reinforcement detail at Grid B-3 column junction?',
      stream:      'design',
    });
    ok(res, 'raise RFI');
    has(res.body, 'id');
    rfiId = res.body.id;
  });

  // ── DESIGN TEAM ANSWERS RFI
  await test('principal answers drawing RFI', async () => {
    if (!rfiId) return;
    const res = await agent.post(`/issues/rfi/${rfiId}/answer`, {
      answer: 'Provide 4-25T bars in column, stirrups at 150 c/c. Refer detail sheet S-05.',
    });
    ok(res, 'answer RFI');
  });

  // ── RFI STATUS
  await test('RFI shows in project list', async () => {
    if (!rfiId) return;
    const res = await agent.get(`/issues/rfi/${projectId}`);
    is(res.status, 200, 'RFI list status');
    const found = (res.body.rfis || res.body.issues || []).find(q => q.id === rfiId);
    has(found, 'id', 'RFI found in list');
  });

  // ── CLOSE RFI
  await test('RFI can be closed', async () => {
    if (!rfiId) return;
    const res = await agent.post(`/issues/rfi/${rfiId}/close`, {
      resolution_note: 'Confirmed on site — reinforcement placed correctly.',
    });
    ok(res, 'close RFI');
  });

  writeState({ drawingId, versionId, queryId: rfiId });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
