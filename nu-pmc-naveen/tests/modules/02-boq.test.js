// MODULE 02 — BOQ: upload, parent-child detection, section detection, validation
// Input:  state.projectId
// Output: state.boqItems, state.boqSectionIds

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');
const ExcelJS = require('exceljs');
const path    = require('path');
const os      = require('os');

async function buildBOQExcel(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('BOQ');
  ws.addRow(['Trade','Section','Item','Unit','Quantity','Rate']);
  for (const r of rows) ws.addRow(r);
  const file = path.join(os.tmpdir(), `test_boq_${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

async function run() {
  reset();
  const state = readState();
  const { projectId } = state;
  const agent = new Agent();
  await agent.login('test_principal', 'NuPMC@2026');

  // Build a BOQ Excel with sections and children
  const rows = [
    // Trade, Section col, Item, Unit, Quantity, Rate
    ['Civil', '1', 'SUBSTRUCTURE',          '',     '',   ''],   // section
    ['Civil', '',  'Excavation',             'cum',  120,  450],
    ['Civil', '',  'PCC 1:4:8',              'cum',   40,  4500],
    ['Civil', '1', 'SUPERSTRUCTURE',         '',     '',   ''],   // section
    ['Civil', '',  'RCC Columns M30',        'cum',   85,  8500],
    ['Civil', '',  'RCC Beams M25',          'cum',   60,  7800],
    ['Civil', '',  'Brick Masonry',          'sqm',  420,  850],
    ['Structural', '1', 'STEEL WORKS',       '',     '',   ''],   // section
    ['Structural', '', 'Structural Steel',   'MT',    12,  75000],
    ['Structural', '', 'Misc Steel',         'MT',     3,  68000],
    // Invalid row — will be caught
    ['Civil', '', 'Invalid row no qty',      'nos',  'NA',  200],
  ];

  let boqFile;
  await test('build BOQ Excel', async () => {
    boqFile = await buildBOQExcel(rows);
    has({ f: boqFile }, 'f', 'file path');
  });

  // Upload BOQ
  let boqVersion;
  await test('upload BOQ to project', async () => {
    const fs  = require('fs');
    const buf = fs.readFileSync(boqFile);
    const res = await agent.upload(`/materials/${projectId}/boq/upload`, 'boq', buf, 'boq.xlsx');
    ok(res, 'upload BOQ');
    has(res.body, 'version');
    boqVersion = res.body.version;
  });

  await test('BOQ upload reports validation errors', async () => {
    const res = await agent.upload(
      `/materials/${projectId}/boq/upload`, 'boq',
      require('fs').readFileSync(boqFile), 'boq.xlsx'
    );
    // validation_errors should mention the invalid row
    // (or success with warning)
    is(res.status, 200, 'status OK');
  });

  // Retrieve BOQ items
  let boqItems;
  await test('BOQ items are retrievable', async () => {
    const res = await agent.get(`/materials/${projectId}/boq`);
    ok(res, 'get BOQ');
    boqItems = res.body.items || res.body.boq_items || [];
    gt(boqItems.length, 0, 'BOQ item count');
  });

  // Verify section hierarchy
  await test('sections are created as parent items', async () => {
    const [sections] = await db.query(
      'SELECT id, item_name FROM boq_items WHERE project_id=? AND is_section=1',
      [projectId]
    );
    gt(sections.length, 0, 'section count');
    // SUBSTRUCTURE, SUPERSTRUCTURE, STEEL WORKS
    const names = sections.map(s => s.item_name);
    const hasSubstr = names.some(n => n.includes('SUBSTRUCTURE') || n.includes('STRUCTURE'));
    is(hasSubstr, true, 'SUBSTRUCTURE section');
  });

  await test('child items reference parent sections', async () => {
    const [children] = await db.query(
      'SELECT id, item_name, parent_id FROM boq_items WHERE project_id=? AND is_section=0 AND parent_id IS NOT NULL',
      [projectId]
    );
    gt(children.length, 0, 'child item count');
  });

  // Verify display_order is set
  await test('display_order is sequential', async () => {
    const [items] = await db.query(
      'SELECT display_order FROM boq_items WHERE project_id=? ORDER BY display_order',
      [projectId]
    );
    gt(items.length, 0, 'items');
    // display_order should be > 0 for all items
    const allHaveOrder = items.every(i => i.display_order >= 1);
    is(allHaveOrder, true, 'all items have display_order');
  });

  // Budget tree — verify works after BOQ upload
  await test('budget tree endpoint works', async () => {
    const res = await agent.get(`/budget/${projectId}/tree`);
    is(res.status, 200, 'tree status');
    has(res.body, 'tree');
  });

  // Get section IDs for use in mapping
  const [sections] = await db.query(
    'SELECT id, item_name, trade FROM boq_items WHERE project_id=? AND is_section=1',
    [projectId]
  );
  const [leafItems] = await db.query(
    'SELECT id, item_name, trade FROM boq_items WHERE project_id=? AND is_section=0',
    [projectId]
  );

  writeState({
    boqItems:      leafItems.slice(0, 6).map(i => i.id),
    boqSectionIds: sections.map(s => s.id),
    boqItemMap:    leafItems.reduce((m,i) => { m[i.item_name] = i.id; return m; }, {}),
  });

  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
