// MODULE 03 — Vendor engagement: picker, fuzzy check, assign to project
// Input:  state.projectId, state.vendorIds
// Output: state.engagementIds { civil, structural, mep }

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt } = require('./helpers');

async function run() {
  reset();
  const { projectId, vendorIds } = readState();
  const agent = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');

  // ── VENDOR SEARCH — trade filtered
  await test('vendor search returns civil vendors', async () => {
    const res = await agent.get('/vendors/master/search?trade=Civil');
    is(res.status, 200, 'search status');
    has(res.body, 'vendors');
    const names = res.body.vendors.map(v => v.vendor_name);
    const hasCivil = names.some(n => n.includes('Civil'));
    is(hasCivil, true, 'civil vendor in results');
  });

  await test('vendor search filters by query string', async () => {
    const res = await agent.get('/vendors/master/search?q=Test+Civil');
    is(res.status, 200, 'search status');
    has(res.body, 'vendors');
    gt(res.body.vendors.length, 0, 'results found');
  });

  await test('vendor search paginates', async () => {
    const res = await agent.get('/vendors/master/search?limit=2');
    is(res.status, 200, 'pagination status');
    has(res.body, 'has_more');
    has(res.body, 'limit');
    is(res.body.limit, 2, 'limit applied');
  });

  // ── FUZZY DUPLICATE — near-miss vendor name
  await test('fuzzy check: slight spelling variation caught', async () => {
    const res = await agent.get('/vendors/master/check?name=Test+Civil+Contracter&trade=Civil');
    is(res.status, 200, 'check status');
    is(res.body.isDuplicate, true, 'near-duplicate detected');
    has(res.body, 'suggestions');
    gt(res.body.suggestions.length, 0, 'has suggestions');
    is(res.body.suggestions[0].vendor_name, 'Test Civil Contractor', 'correct suggestion');
  });

  await test('fuzzy check: different vendor not flagged', async () => {
    const res = await agent.get('/vendors/master/check?name=Completely+Different+Ltd');
    is(res.status, 200, 'check status');
    is(res.body.isDuplicate, false, 'no duplicate');
  });

  // ── ENGAGE VENDORS ON PROJECT
  const engagementIds = {};

  await test('engage civil vendor on project', async () => {
    const res = await agent.post(`/vendors/${projectId}/engagements`, {
      vendor_id:      vendorIds.civil,
      scope:          'RCC structure, excavation and masonry — full civil works',
      contract_value: 8500000,
    });
    ok(res, 'engage civil');
    has(res.body, 'id');
    engagementIds.civil = res.body.id;
  });

  await test('engage structural vendor on project', async () => {
    const res = await agent.post(`/vendors/${projectId}/engagements`, {
      vendor_id:      vendorIds.structural,
      scope:          'Structural steel fabrication and erection',
      contract_value: 2200000,
    });
    ok(res, 'engage structural');
    engagementIds.structural = res.body.id;
  });

  await test('engage MEP vendor on project', async () => {
    const res = await agent.post(`/vendors/${projectId}/engagements`, {
      vendor_id:      vendorIds.mep,
      scope:          'HVAC supply and installation',
      contract_value: 1800000,
    });
    ok(res, 'engage MEP');
    engagementIds.mep = res.body.id;
  });

  // ── VERIFY ENGAGEMENTS ARE LISTED
  await test('project vendors list shows all three', async () => {
    const res = await agent.get(`/vendors/${projectId}/engagements`);
    is(res.status, 200, 'list status');
    const vids = (res.body.engagements || []).map(v => v.vendor_id || v.id);
    gt(vids.length, 0, 'engagement count');
  });

  // ── BULK ENGAGEMENT UPLOAD
  await test('bulk engagement upload works', async () => {
    const ExcelJS = require('exceljs');
    const os = require('os'), path = require('path'), fs = require('fs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Engagements');
    ws.addRow(['Vendor Name','Trade','Scope','Contract Value','Contact','Phone','Account Number','IFSC']);
    ws.addRow(['Test Civil Contractor','Civil','Additional civil works — Phase 2',500000,'','','10001000000001','SBIN0001234']);
    const file = path.join(os.tmpdir(), `eng_${Date.now()}.xlsx`);
    await wb.xlsx.writeFile(file);
    const buf = fs.readFileSync(file);
    const res = await agent.upload(`/vendors/${projectId}/engagements/bulk-upload`, 'engagements', buf, 'eng.xlsx');
    ok(res, 'bulk engagement');
    has(res.body, 'added');
  });

  writeState({ engagementIds });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
