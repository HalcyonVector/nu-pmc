// MODULE 01 — Setup: users, clients, vendors, projects
// Creates the test universe that all other modules depend on
// Output → state: { principalId, pmcId, siteId, financeId, vendorIds, clientId, projectId }

const { test, summary, reset, writeState, Agent, ok, is, has, gt, db, dbClean } = require('./helpers');
const bcrypt = require('bcryptjs');

const TEST_PREFIX = 'test_';

async function run() {
  reset();
  const agent = new Agent();

  // ── SEED: create principal user directly (before login exists)
  await test('seed principal user', async () => {
    const hash = await bcrypt.hash('NuPMC@2026', 10);
    await db.query(`
      INSERT INTO users (username, password_hash, full_name, role, phone, email, stream, is_active)
      VALUES (?,?,?,?,?,?,?,1)
      ON DUPLICATE KEY UPDATE is_active=1, password_hash=VALUES(password_hash)`,
      ['test_principal', hash, 'Test Principal', 'principal', '919000000001',
       'test_principal@nu.test', 'all']
    );
  });

  // ── LOGIN
  await test('principal can login', async () => {
    await agent.login('test_principal', 'NuPMC@2026');
  });

  // ── CREATE USERS — PMC, site manager, finance admin
  let pmcId, siteId, financeId;
  await test('create PMC user', async () => {
    const res = await agent.post('/users', {
      username: 'test_pmc', password: 'NuPMC@2026',
      full_name: 'Test PMC Head', role: 'pmc_head',
      phone: '919000000002', stream: 'all',
    });
    ok(res, 'create PMC');
    has(res.body, 'id');
    pmcId = res.body.id;
  });

  await test('create site manager', async () => {
    const res = await agent.post('/users', {
      username: 'test_site', password: 'NuPMC@2026',
      full_name: 'Test Site Manager', role: 'site_manager',
      phone: '919000000003', stream: 'site',
    });
    ok(res, 'create site');
    siteId = res.body.id;
  });

  await test('create finance admin', async () => {
    const res = await agent.post('/users', {
      username: 'test_finance', password: 'NuPMC@2026',
      full_name: 'Test Finance Admin', role: 'finance_admin',
      phone: '919000000004', stream: 'all',
    });
    ok(res, 'create finance');
    financeId = res.body.id;
  });

  // ── CREATE CLIENT
  let clientId;
  await test('create client', async () => {
    const res = await agent.post('/clients', {
      client_name:      'Test Client Pvt Ltd',
      gstin:            '29AAAAA0000A1Z5',
      state_code:       29,
      state_name:       'Karnataka',
      contact_person:   'Test Contact',
      contact_phone:    '919000000099',
      contact_whatsapp: '919000000099',
      contact_email:    'test@testclient.com',
      gstin:            '29TESTX1234X1Z5',
    });
    ok(res, 'create client');
    has(res.body, 'id');
    clientId = res.body.id;
  });

  // ── FUZZY DUPLICATE CHECK — same client name should be caught
  await test('fuzzy check catches near-duplicate client', async () => {
    const res = await agent.get('/clients/check?name=Test+Client+Pvt+Ltd');
    is(res.status, 200, 'check status');
    is(res.body.isDuplicate, true, 'should detect duplicate');
  });

  // ── CREATE VENDORS
  const vendorIds = {};
  for (const [key, v] of Object.entries({
    civil:      { name: 'Test Civil Contractor',  trade: 'Civil',      bank: '10001000000001', ifsc: 'SBIN0001234' },
    structural: { name: 'Test Structural Pvt Ltd', trade: 'Structural', bank: '10001000000002', ifsc: 'HDFC0001234' },
    mep:        { name: 'Test MEP Solutions',      trade: 'HVAC',       bank: '10001000000003', ifsc: 'ICIC0001234' },
  })) {
    await test(`create ${key} vendor`, async () => {
      const res = await agent.post('/vendors/master', {
        vendor_name: v.name, trade: v.trade,
        phone: '919000000010', bank_account: v.bank, bank_ifsc: v.ifsc,
      });
      ok(res, `create ${key} vendor`);
      has(res.body, 'id');
      vendorIds[key] = res.body.id;
    });
  }

  // ── FUZZY DUPLICATE CHECK — vendor spelling
  await test('fuzzy check catches near-duplicate vendor', async () => {
    const res = await agent.get('/vendors/master/check?name=Test+Civil+Contracter&trade=Civil');
    is(res.status, 200, 'check status');
    is(res.body.isDuplicate, true, 'should catch typo');
  });

  // ── CREATE PROJECT
  let projectId;
  await test('create project', async () => {
    const res = await agent.post('/projects', {
      code:            'TESTP1',
      name:            'Test Project Alpha',
      client:          'Test Client Pvt Ltd',
      client_id:       clientId,
      location:        'Electronic City, Bengaluru',
      project_type:    'industrial',
      r0_start_date:   '2026-05-01',
      r0_end_date:     '2027-04-30',
      jurisdiction:    'BBMP',
      contract_value:  25000000,
      start_date:      '2026-05-01',
      completion_date: '2027-05-01',
    });
    ok(res, 'create project');
    has(res.body, 'id');
    projectId = res.body.id;
  });

  // ── STUB-CLIENT FLOW — project with plain text client, no client_id
  let stubProjectId, stubClientId;
  await test('project with plain-text client creates stub', async () => {
    const res = await agent.post('/projects', {
      code:            'STUBP1',
      name:            'Stub Client Test Project',
      client:          'Acme Brand New Industries Ltd',
      location:        'Sarjapur',
      project_type:    'commercial',
      r0_start_date:   '2026-06-01',
      r0_end_date:     '2027-05-31',
    });
    ok(res, 'create project with text client');
    is(res.body.client_stub_created, true, 'stub flag set');
    has(res.body, 'client_id');
    stubProjectId = res.body.id;
    stubClientId  = res.body.client_id;
  });

  await test('stub appears in /clients/incomplete', async () => {
    const res = await agent.get('/clients/incomplete');
    ok(res, 'list incomplete clients');
    has(res.body, 'clients');
    const stub = res.body.clients.find(c => c.id === stubClientId);
    if (!stub) throw new Error('stub client not in incomplete list');
    is(stub.client_name, 'Acme Brand New Industries Ltd', 'stub name matches');
  });

  await test('PI creation refuses incomplete client', async () => {
    // Try to raise a PI — should get CLIENT_INCOMPLETE (we don't even need a fee_schedule_id
    // because the client guard runs first)
    const res = await agent.post(`/invoices/${stubProjectId}/pi`, {
      fee_schedule_id: 999,  // doesn't exist, but guard runs first
    });
    is(res.status, 400, 'should be 400');
    is(res.body.code, 'CLIENT_INCOMPLETE', 'error code CLIENT_INCOMPLETE');
  });

  await test('complete client master', async () => {
    const res = await agent.patch(`/clients/${stubClientId}/complete`, {
      client_name:        'Acme Brand New Industries Ltd',
      gstin:              '29AAAAA1234A1Z5',
      state_name:         'Karnataka',
      state_code:         29,
      pan:                'AAAAA1234A',
      tally_party_ledger: 'Acme BrandNew',
      payment_terms_days: 45,
      contact_person:     'Test Contact',
      contact_phone:      '919900001234',
      contact_email:      'test@acme.test',
    });
    ok(res, 'complete client');
  });

  await test('second completion attempt refused', async () => {
    const res = await agent.patch(`/clients/${stubClientId}/complete`, {
      client_name: 'Acme Brand New Industries Ltd',
      gstin:       '29AAAAA1234A1Z5',
    });
    is(res.status, 400, 'already-complete returns 400');
    is(res.body.code, 'ALREADY_COMPLETE', 'code ALREADY_COMPLETE');
  });

  await test('completed stub no longer in incomplete list', async () => {
    const res = await agent.get('/clients/incomplete');
    ok(res, 'list incomplete again');
    const stillStub = res.body.clients.find(c => c.id === stubClientId);
    if (stillStub) throw new Error('completed client still in incomplete list');
  });

  await test('same-name second project reuses existing client', async () => {
    const res = await agent.post('/projects', {
      code:            'STUBP2',
      name:            'Reuse Existing Client Project',
      client:          'Acme Brand New Industries Ltd',  // same name
      location:        'Sarjapur',
      project_type:    'commercial',
      r0_start_date:   '2026-07-01',
      r0_end_date:     '2027-06-30',
    });
    ok(res, 'reuse project');
    is(res.body.client_stub_created, false, 'no new stub — reused');
    is(res.body.client_id, stubClientId, 'same client_id');
  });

  // ── ASSIGN TEAM TO PROJECT
  await test('assign PMC to project', async () => {
    const res = await agent.post(`/projects/${projectId}/assign`, {
      user_id: pmcId, role: 'pmc_head',
    });
    ok(res, 'assign PMC');
  });

  await test('assign site manager to project', async () => {
    const res = await agent.post(`/projects/${projectId}/assign`, {
      user_id: siteId, role: 'site_manager',
    });
    ok(res, 'assign site');
  });

  // ── GET PROJECT — verify it exists
  await test('project is accessible', async () => {
    const res = await agent.get(`/projects/${projectId}`);
    is(res.status, 200, 'get project');
    has(res.body, 'project');
    has(res.body.project, 'id');
  });

  // ── GET PRINCIPAL ID
  const [[me]] = await db.query("SELECT id FROM users WHERE username='test_principal'");

  // ── PERSIST STATE for subsequent modules
  writeState({
    principalId: me.id,
    pmcId,
    siteId,
    financeId,
    clientId,
    projectId,
    vendorIds,
  });

  return summary();
}

module.exports = { run };
if (require.main === module) run().then(r => process.exit(r.failed));
