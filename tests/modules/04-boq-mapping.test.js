// MODULE 04 — BOQ↔Vendor mapping: AI suggest, confirm, manual map
// Input:  state.projectId, state.engagementIds, state.boqItems
// Output: state.mappingIds

const { test, summary, reset, readState, writeState, Agent, ok, is, has, gt, db } = require('./helpers');

async function run() {
  reset();
  const { projectId, engagementIds, boqItems } = readState();
  const agent = new Agent();
  await agent.login('test_pmc', 'NuPMC@2026');

  // ── GET MAPPING STATUS
  let data;
  await test('mapping endpoint returns engagements and BOQ items', async () => {
    const res = await agent.get(`/boq-mapping/${projectId}`);
    ok(res, 'get mappings');
    has(res.body, 'engagements');
    has(res.body, 'boq_items');
    has(res.body, 'unmapped_count');
    data = res.body;
    gt(data.engagements.length, 0, 'engagements present');
    gt(data.boq_items.length, 0, 'BOQ items present');
  });

  // ── AI SUGGEST (graceful if no AI key)
  let suggestions = [];
  await test('AI suggest returns gracefully without API key', async () => {
    const res = await agent.post(`/boq-mapping/${projectId}/suggest`, {});
    is(res.status, 200, 'suggest status');
    has(res.body, 'suggestions');
    suggestions = res.body.suggestions || [];
    // ai_used will be false if no key — keyword fallback should still work
  });

  // ── MANUAL MAPPING — civil engagement → civil BOQ items
  let mappingId;
  await test('manual mapping: civil engagement to BOQ items', async () => {
    const civBoqItems = boqItems.slice(0, 3); // first 3 BOQ items
    const res = await agent.post(`/boq-mapping/${projectId}`, {
      engagement_id: engagementIds.civil,
      boq_item_ids:  civBoqItems,
      notes:         'Full civil scope maps to excavation, PCC, and RCC items',
    });
    ok(res, 'save mapping');
    has(res.body, 'saved');
    gt(res.body.saved, 0, 'items mapped');
  });

  // ── STRUCTURAL MAPPING
  await test('structural engagement mapped to steel BOQ items', async () => {
    const structItems = boqItems.slice(-2); // last 2
    const res = await agent.post(`/boq-mapping/${projectId}`, {
      engagement_id: engagementIds.structural,
      boq_item_ids:  structItems,
    });
    ok(res, 'structural mapping');
  });

  // ── VERIFY MAPPINGS PERSIST
  await test('mappings are persisted and retrievable', async () => {
    const res = await agent.get(`/boq-mapping/${projectId}`);
    ok(res, 'get after map');
    const mappings = res.body.mappings || [];
    gt(mappings.length, 0, 'mappings exist after save');
  });

  // ── DUPLICATE MAPPING (ON DUPLICATE KEY UPDATE — should not crash)
  await test('duplicate mapping update does not error', async () => {
    const res = await agent.post(`/boq-mapping/${projectId}`, {
      engagement_id: engagementIds.civil,
      boq_item_ids:  [boqItems[0]],
      notes:         'Updated note',
    });
    ok(res, 'duplicate mapping upsert');
  });

  // ── DELETE MAPPING
  await test('mapping can be deleted', async () => {
    const [rows] = await db.query(
      'SELECT id FROM vendor_boq_mapping WHERE project_id=? LIMIT 1', [projectId]
    );
    if (rows.length) {
      const res = await agent.delete(`/boq-mapping/${projectId}/${rows[0].id}`);
      ok(res, 'delete mapping');
    }
  });

  const [mappings] = await db.query(
    'SELECT id FROM vendor_boq_mapping WHERE project_id=?', [projectId]
  );

  writeState({ mappingIds: mappings.map(m => m.id) });
  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
