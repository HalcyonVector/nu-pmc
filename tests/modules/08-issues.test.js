// MODULE 08 — Issues: raise, route by type, PMC confirm, design respond
// Input:  state.projectId, state.drawingId
// Output: state.issueIds

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');

async function run() {
  reset();
  const { projectId, drawingId } = readState();
  const siteAgt = new Agent();
  const pmcAgt  = new Agent();
  const agent   = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');
  await siteAgt.login('test_site', 'NuPMC@2026');
  await pmcAgt.login('test_pmc', 'NuPMC@2026');

  const issueIds = {};

  // ── SAFETY ISSUE — requires PMC confirmation
  await test('site raises safety issue', async () => {
    const res = await siteAgt.post(`/issues/${projectId}`, {
      issue_type:  'safety',
      title:       'Scaffolding not tied at level 3',
      description: 'Labour observed removing tie rods from scaffolding at level 3. Risk of collapse.',
      location:    'Grid C4, Level 3',
    });
    ok(res, 'raise safety issue');
    has(res.body, 'id');
    issueIds.safety = res.body.id;
    is(res.body.message.includes('PMC'), true, 'message mentions PMC');
  });

  // ── SAFETY ISSUE IS IN DRAFT — needs PMC confirmation
  await test('safety issue is in draft before PMC confirm', async () => {
    const [[issue]] = await db.query('SELECT status FROM issues WHERE id=?', [issueIds.safety]);
    is(issue.status, 'draft', 'draft status');
  });

  // ── PMC CONFIRMS SAFETY ISSUE
  await test('PMC confirms safety issue into register', async () => {
    const res = await pmcAgt.patch(`/issues/${issueIds.safety}/confirm`, {
      due_date: new Date(Date.now() + 2*86400000).toLocaleDateString('en-CA'),
    });
    ok(res, 'PMC confirm safety');
  });

  await test('safety issue is now open in register', async () => {
    const [[issue]] = await db.query('SELECT status FROM issues WHERE id=?', [issueIds.safety]);
    is(issue.status, 'open', 'open status after confirm');
  });

  // ── DESIGN ISSUE — auto-routes to design head (no PMC confirm needed)
  await test('site raises design issue (auto-routes)', async () => {
    const res = await siteAgt.post(`/issues/${projectId}`, {
      issue_type:  'design',
      title:       'Column grid reference missing on drawing A003',
      description: 'Drawing A003 does not show Grid D dimensions. Cannot set out.',
      drawing_id:  drawingId,
    });
    ok(res, 'raise design issue');
    has(res.body, 'id');
    issueIds.design = res.body.id;
  });

  await test('design issue is open immediately (no draft)', async () => {
    const [[issue]] = await db.query('SELECT status FROM issues WHERE id=?', [issueIds.design]);
    is(issue.status, 'open', 'auto-routed design issue is open');
  });

  // ── QUALITY ISSUE
  await test('PMC raises quality issue', async () => {
    const res = await pmcAgt.post(`/issues/${projectId}`, {
      issue_type:  'quality',
      title:       'Concrete cube test failure — batch 006',
      description: 'Cube test at 7 days shows 18 N/mm2 against required 21 N/mm2. M25 mix proportions to be reviewed.',
    });
    ok(res, 'raise quality issue');
    issueIds.quality = res.body.id;
  });

  // ── LIST ISSUES — PMC sees all
  await test('PMC sees all issues in project', async () => {
    const res = await pmcAgt.get(`/issues/${projectId}`);
    is(res.status, 200, 'list status');
    has(res.body, 'issues');
    gt(res.body.issues.length, 0, 'issues present');
  });

  // ── DISMISS AN ISSUE
  await test('PMC can dismiss a draft issue', async () => {
    // Raise and immediately dismiss
    const newIss = await pmcAgt.post(`/issues/${projectId}`, {
      issue_type:  'safety',
      title:       'Test dismiss issue',
      description: 'Should be dismissed immediately',
    });
    if (newIss.body?.id) {
      const res = await pmcAgt.patch(`/issues/${newIss.body.id}/dismiss`);
      ok(res, 'dismiss issue');
    }
  });

  writeState({ issueIds });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
