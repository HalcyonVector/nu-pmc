// modules/finance/tests/icici-bank-guard.test.js
// ════════════════════════════════════════════════════════════════════════════
// v5.24 ICICI bank-validation guard.
// The guard refuses to emit a bank batch (preview blockers + generate refusal)
// for any vendor whose bank_validated_by_vendor=0.
// ════════════════════════════════════════════════════════════════════════════

const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => {
  const m = { query: jest.fn() };
  m.tx = jest.fn((fn) => fn({ query: m.query }));
  return m;
});
jest.mock('../../../services/audit', () => ({ log: jest.fn() }));

// The Onboarding contract is what supplies bank_validated_by_vendor onto
// payment rows. Mock it directly so we don't need to wire its DB joins.
jest.mock('../../onboarding/contract', () => ({
  functions: {
    getProject: jest.fn(),
    getVendorsByIds: jest.fn(),
    getEngagementsByIds: jest.fn(),
  },
}));

const db = require('../../../middleware/db');
const Onboarding = require('../../onboarding/contract');
const perms = require('../../../middleware/permissions');
perms._setCacheForTests([
  { role: 'pmc_head',          action: 'admin.vendor.update', level: 'W' },
  { role: 'principal',         action: 'admin.vendor.update', level: 'A' },
  { role: 'design_principal',  action: 'admin.vendor.update', level: 'A' },
  // For the icici endpoints — finance + pmc gates rely on requireFinance/requirePMC,
  // which are role-only, not perm-driven.
]);

function makeApp(role = 'pmc_head', userId = 9) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = {
      id: userId, username: `u${userId}`, full_name: 'Test',
      role, stream: 'all',
      // requireProjectScope reads from req.session.user.projects
      projects: [{ project_id: 7, scope: 'project_lead' }],
      projects_at: Date.now(),
    };
    next();
  });
  app.use('/api/payments', require('../routes/payments'));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
  Onboarding.functions.getProject.mockResolvedValue({ id: 7, name: 'Test Project', code: 'TP' });
});

// ── Helper: stub the bundle of DB calls that gatherApprovedPayments + the
// route do, with two payments where vendor B has bank_validated_by_vendor=0.
function seedTwoPayments({ aValidated = 1, bValidated = 0 } = {}) {
  // gatherApprovedPayments — SELECT vendor_payments
  db.query.mockResolvedValueOnce([[
    { id: 100, project_id: 7, vendor_id: 5, engagement_id: 50,
      status: 'approved', actual_amount: '100000', recommended_amount: '100000' },
    { id: 101, project_id: 7, vendor_id: 6, engagement_id: 51,
      status: 'approved', actual_amount: '50000', recommended_amount: '50000' },
  ]]);
  Onboarding.functions.getVendorsByIds.mockResolvedValueOnce(new Map([
    [5, { id: 5, vendor_name: 'Acme Validated',  bank_account: 'A1', bank_ifsc: 'I1', bank_name: 'HDFC',
          trade: 'civil', pan_validated: 1, bank_validated_by_vendor: aValidated }],
    [6, { id: 6, vendor_name: 'Beta Unvalidated', bank_account: 'B2', bank_ifsc: 'I2', bank_name: 'ICICI',
          trade: 'plumbing', pan_validated: 1, bank_validated_by_vendor: bValidated }],
  ]));
  Onboarding.functions.getEngagementsByIds.mockResolvedValueOnce(new Map([
    [50, { id: 50, scope: 'civil works' }],
    [51, { id: 51, scope: 'plumbing' }],
  ]));
}

// ── PREVIEW ──────────────────────────────────────────────────────────────────

describe('GET /api/payments/:project_id/icici/preview — bank-validation guard', () => {
  test('vendor with bank_validated_by_vendor=0 produces blockers + can_generate=false', async () => {
    const app = makeApp('pmc_head');
    seedTwoPayments({ aValidated: 1, bValidated: 0 });

    const res = await request(app)
      .get('/api/payments/7/icici/preview?payment_ids=100,101');

    expect(res.status).toBe(200);
    expect(res.body.can_generate).toBe(false);
    expect(res.body.blockers).toBeTruthy();
    expect(res.body.blockers.bank_not_validated).toEqual(['Beta Unvalidated']);
    expect(res.body.blockers.pan_not_validated).toBeUndefined();
    expect(res.body.warning).toMatch(/not yet confirmed/i);
  });

  test('all vendors validated: can_generate=true, no blockers', async () => {
    const app = makeApp('pmc_head');
    seedTwoPayments({ aValidated: 1, bValidated: 1 });

    const res = await request(app)
      .get('/api/payments/7/icici/preview?payment_ids=100,101');

    expect(res.status).toBe(200);
    expect(res.body.can_generate).toBe(true);
    expect(res.body.blockers).toBeNull();
  });

  test('rows include the per-vendor bank_validated_by_vendor flag', async () => {
    const app = makeApp('pmc_head');
    seedTwoPayments({ aValidated: 1, bValidated: 0 });

    const res = await request(app)
      .get('/api/payments/7/icici/preview?payment_ids=100,101');

    expect(res.status).toBe(200);
    const rows = res.body.rows;
    expect(rows.find(r => r.vendor_name === 'Acme Validated').bank_validated_by_vendor).toBe(true);
    expect(rows.find(r => r.vendor_name === 'Beta Unvalidated').bank_validated_by_vendor).toBe(false);
  });
});

// ── GENERATE ─────────────────────────────────────────────────────────────────

describe('POST /api/payments/:project_id/icici/generate — bank-validation guard', () => {
  // For non-project-scoped roles (pmc_head, principal, design_principal),
  // requireProjectScope() does a `SELECT status FROM projects WHERE id = ?`
  // BEFORE the route handler runs. We stub that here so the helper below
  // and each test can chain its own mocks cleanly.
  function stubProjectStatus(status = 'open') {
    db.query.mockResolvedValueOnce([[{ status }]]);
  }

  test('refuses to generate when any vendor in batch is unvalidated', async () => {
    const app = makeApp('pmc_head');
    stubProjectStatus();
    seedTwoPayments({ aValidated: 1, bValidated: 0 });

    const res = await request(app)
      .post('/api/payments/7/icici/generate')
      .send({ payment_ids: [100, 101], confirmation: 'GENERATE', expected_total: 150000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BANK_NOT_VALIDATED');
    expect(res.body.unvalidated).toEqual(['Beta Unvalidated']);
  });

  test('PAN guard fires before bank guard (preserves existing precedence)', async () => {
    const app = makeApp('pmc_head');
    stubProjectStatus();
    // Both vendors PAN-unvalidated — PAN guard should win
    db.query.mockResolvedValueOnce([[
      { id: 100, project_id: 7, vendor_id: 5, engagement_id: 50, status: 'approved',
        actual_amount: '100000', recommended_amount: '100000' },
      { id: 101, project_id: 7, vendor_id: 6, engagement_id: 51, status: 'approved',
        actual_amount: '50000',  recommended_amount: '50000' },
    ]]);
    Onboarding.functions.getVendorsByIds.mockResolvedValueOnce(new Map([
      [5, { id: 5, vendor_name: 'A', bank_account: 'A1', bank_ifsc: 'I1', bank_name: 'H',
            trade: 'c', pan_validated: 0, bank_validated_by_vendor: 0 }],
      [6, { id: 6, vendor_name: 'B', bank_account: 'B2', bank_ifsc: 'I2', bank_name: 'I',
            trade: 'p', pan_validated: 0, bank_validated_by_vendor: 0 }],
    ]));
    Onboarding.functions.getEngagementsByIds.mockResolvedValueOnce(new Map([
      [50, { id: 50, scope: 'civil' }],
      [51, { id: 51, scope: 'plumb' }],
    ]));

    const res = await request(app)
      .post('/api/payments/7/icici/generate')
      .send({ payment_ids: [100, 101], confirmation: 'GENERATE', expected_total: 150000 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAN_NOT_VALIDATED');
  });

  test('all vendors validated: passes the bank-validation guard (will fail later on missing approval rows etc, that is OK for this test)', async () => {
    const app = makeApp('pmc_head');
    stubProjectStatus();
    seedTwoPayments({ aValidated: 1, bValidated: 1 });

    const res = await request(app)
      .post('/api/payments/7/icici/generate')
      .send({ payment_ids: [100, 101], confirmation: 'GENERATE', expected_total: 150000 });

    // We don't mock the rest of the generate path. The bank guard MUST not
    // be the thing that returns. Whatever else happens (200/500 from
    // downstream), it must NOT be the BANK_NOT_VALIDATED code.
    if (res.status === 400) {
      expect(res.body.code).not.toBe('BANK_NOT_VALIDATED');
    }
  });
});
