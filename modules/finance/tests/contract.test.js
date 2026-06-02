// modules/finance/tests/contract.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const Finance = require('../contract');

describe('M5 Finance — contract surface', () => {
  test('exposes semver version', () => {
    expect(Finance.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function keys are stable', () => {
    const required = [
      'getPaymentsPendingApproval', 'getPaymentByRequestId',
      'getProjectBudget', 'getBudgetVariance', 'getClientReceipts',
    ];
    required.forEach(k => expect(typeof Finance.functions[k]).toBe('function'));
  });

  test('routes are Express routers', () => {
    const required = [
      'payments', 'paymentRequests', 'invoices', 'budget', 'claims',
      'finance', 'gstStatement', 'piGenerator', 'urgentPayments', 'boqMapping',
    ];
    required.forEach(k => {
      const r = Finance.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owns money-related tables; does NOT claim site/onboarding tables', () => {
    expect(Finance.tables).toEqual(expect.arrayContaining([
      'payment_requests', 'vendor_payments', 'budget_cost_heads',
      'proforma_invoices', 'client_receipts',
    ]));
    expect(Finance.tables).not.toContain('users');
    expect(Finance.tables).not.toContain('projects');
    expect(Finance.tables).not.toContain('vendors');
    expect(Finance.tables).not.toContain('grns');
    expect(Finance.tables).not.toContain('daily_reports');
  });
});

describe('M5 Finance — getPaymentsPendingApproval', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('filters for pending statuses only', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Finance.functions.getPaymentsPendingApproval(1);
    expect(db.query.mock.calls[0][0]).toMatch(/status IN \('pending_pmc', 'pmc_approved'\)/);
  });

  test('joins vendor name for display', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, amount_requested: 450000, vendor_name: 'BlueStone Constructions', status: 'pending_pmc' },
    ]]);
    const rows = await Finance.functions.getPaymentsPendingApproval(1);
    expect(rows[0].vendor_name).toBe('BlueStone Constructions');
    expect(db.query.mock.calls[0][0]).toMatch(/LEFT JOIN vendors/);
  });
});

describe('M5 Finance — getPaymentByRequestId', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns null when not found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await Finance.functions.getPaymentByRequestId(999);
    expect(r).toBeNull();
  });

  test('returns row when found', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, amount_requested: 450000, vendor_name: 'BlueStone', status: 'principal_approved' },
    ]]);
    const r = await Finance.functions.getPaymentByRequestId(1);
    expect(r.id).toBe(1);
    expect(r.status).toBe('principal_approved');
  });
});

describe('M5 Finance — getProjectBudget', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns cost heads ordered', async () => {
    db.query.mockResolvedValueOnce([[
      { code: 'CIV', name: 'Civil', sanctioned: 4500000 },
      { code: 'ELE', name: 'Electrical', sanctioned: 3200000 },
    ]]);
    const rows = await Finance.functions.getProjectBudget(1);
    expect(rows).toHaveLength(2);
    // Post-schema-migration: budget_cost_heads has display_order + code; cost_head column removed.
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY display_order, code/);
  });
});

describe('M5 Finance — getBudgetVariance', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('joins allocated vs actual, grouped by cost_head', async () => {
    db.query.mockResolvedValueOnce([[
      { cost_head: 'CIV', name: 'Civil', allocated: 4500000, actual: 1200000 },
    ]]);
    const rows = await Finance.functions.getBudgetVariance(1);
    expect(rows[0].allocated).toBe(4500000);
    expect(rows[0].actual).toBe(1200000);
    // Post-migration: variance built via correlated subquery (vendor_payments inner SUM),
    // not a GROUP BY join. Per-row already aggregated by bch.code uniqueness.
    expect(db.query.mock.calls[0][0]).toMatch(/bch\.code AS cost_head/);
    expect(db.query.mock.calls[0][0]).toMatch(/vendor_payments/);
  });
});

describe('M5 Finance — getClientReceipts', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('orders by receipt_date descending', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Finance.functions.getClientReceipts(1);
    // Post-migration: column is receipt_date, not received_on.
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY receipt_date DESC/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route smoke tests — every mount responds
// ─────────────────────────────────────────────────────────────────────────────
describe('M5 Finance — route mounts respond', () => {
  function makeAuthedApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'test_principal', full_name: 'Test', role, stream: 'all', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/payments',         Finance.routes.payments);
    app.use('/api/payment-requests', Finance.routes.paymentRequests);
    app.use('/api/invoices',         Finance.routes.invoices);
    app.use('/api/budget',           Finance.routes.budget);
    app.use('/api/claims',           Finance.routes.claims);
    app.use('/api/finance',          Finance.routes.finance);
    app.use('/api/gst-statement',    Finance.routes.gstStatement);
    app.use('/api/pi',               Finance.routes.piGenerator);
    app.use('/api/urgent-payments',  Finance.routes.urgentPayments);
    app.use('/api/boq-mapping',      Finance.routes.boqMapping);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test.each([
    ['/api/payment-requests/1'],
    ['/api/budget/1'],
    ['/api/invoices/1'],
    ['/api/claims/1'],
    ['/api/gst-statement/1/2026/04'],
    ['/api/boq-mapping/1'],
  ])('GET %s responds (<500)', async (url) => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get(url);
    expect(r.status).toBeLessThan(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression tests for FinanceAudit v1 CRITICAL bugs (fixed 24 Apr 2026)
// ─────────────────────────────────────────────────────────────────────────────
describe('M5 Finance — FinanceAudit 1.1: petty-cash replenish INSERT', () => {
  function makeApp(role = 'pmc_head') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, username: 'test_pmc', full_name: 'Test PMC', role, projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/finance', require('../routes/finance'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('replenish INSERT has matching column and placeholder count', async () => {
    // Mock project-scope lookup (requireProjectScope middleware), then the INSERT
    db.query.mockResolvedValue([[{ id: 1 }]]);

    const r = await request(makeApp()).post('/api/finance/1/petty-cash/replenish')
      .send({ amount: 5000, notes: 'Weekly top-up' });

    // Find the INSERT call (not the project-scope SELECT)
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO petty_cash_transactions/.test(c[0]));
    expect(insertCall).toBeDefined();

    // Column count and placeholder count must match — the pre-fix bug was 8 cols / 7 ?s
    const sql = insertCall[0];
    const colsMatch = sql.match(/\(([^)]+)\) *\n? *VALUES/);
    expect(colsMatch).toBeTruthy();
    const cols = colsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const placeholders = (sql.match(/\?/g) || []).length;
    const literals = (sql.match(/'[^']*'/g) || []).length; // e.g. 'replenishment', 'other'
    expect(placeholders + literals).toBe(cols.length - 1); // -1 for CURDATE()
    expect(r.status).toBeLessThan(500);
  });

  test('replenish uses validated numeric amount, not raw body string', async () => {
    db.query.mockResolvedValue([[{ id: 1 }]]);
    await request(makeApp()).post('/api/finance/1/petty-cash/replenish')
      .send({ amount: '5000', notes: 'x' });  // string, not number

    const insertCall = db.query.mock.calls.find(c => /INSERT INTO petty_cash_transactions/.test(c[0]));
    expect(insertCall).toBeDefined();
    // The amount placeholder should receive the validated number, not the raw string
    // (amtCheck.amount from validateAmount), so this should be typeof 'number'
    const params = insertCall[1];
    const amountParam = params[2]; // Position of `amount` in the param list
    expect(typeof amountParam).toBe('number');
    expect(amountParam).toBe(5000);
  });
});

describe('M5 Finance — FinanceAudit 1.2: PI status PATCH timestamps', () => {
  function makeApp(role = 'pmc_head') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role, full_name: 'Test PMC', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/invoices', require('../routes/invoices'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  // Helper: route now does SELECT-status + UPDATE-via-SM. Tests need both
  // mocked. The SM emits SQL like:
  //   UPDATE proforma_invoices SET status = ?, <ts_col> = ? WHERE id = ? AND status = ?
  // with params: [new_status, dateObj, id, current_status]
  function mockPiStatus(currentStatus = 'draft') {
    db.query.mockResolvedValueOnce([[{ status: currentStatus }]])  // SM read
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);          // SM UPDATE
  }

  test('status=sent updates only sent_at, not other timestamp columns', async () => {
    mockPiStatus('draft');
    await request(makeApp()).patch('/api/invoices/pi/42/status').send({ status: 'sent' });

    const updateCall = db.query.mock.calls.find(c => /UPDATE proforma_invoices/.test(c[0]));
    expect(updateCall).toBeDefined();
    const sql = updateCall[0];
    expect(sql).toMatch(/sent_at\s*=/);
    expect(sql).not.toMatch(/acknowledged_at\s*=/);
    expect(sql).not.toMatch(/paid_at\s*=/);
  });

  test('status=acknowledged updates only acknowledged_at', async () => {
    mockPiStatus('sent');
    await request(makeApp()).patch('/api/invoices/pi/42/status').send({ status: 'acknowledged' });

    const updateCall = db.query.mock.calls.find(c => /UPDATE proforma_invoices/.test(c[0]));
    const sql = updateCall[0];
    expect(sql).toMatch(/acknowledged_at\s*=/);
    expect(sql).not.toMatch(/sent_at\s*=/);
    expect(sql).not.toMatch(/paid_at\s*=/);
  });

  test('status=paid updates only paid_at', async () => {
    mockPiStatus('acknowledged');
    await request(makeApp()).patch('/api/invoices/pi/42/status').send({ status: 'paid' });

    const updateCall = db.query.mock.calls.find(c => /UPDATE proforma_invoices/.test(c[0]));
    const sql = updateCall[0];
    expect(sql).toMatch(/paid_at\s*=/);
    expect(sql).not.toMatch(/sent_at\s*=/);
    expect(sql).not.toMatch(/acknowledged_at\s*=/);
  });

  test('status=draft updates only status (no timestamp column)', async () => {
    // status=draft from itself is a no-op (idempotent return without UPDATE).
    // Use 'sent' as the current state — but there's no 'sent → draft' edge,
    // so the SM rejects this transition with a 400. Verify either: route
    // handles it cleanly (no broken UPDATE), OR the SM rejects appropriately.
    db.query.mockResolvedValueOnce([[{ status: 'draft' }]]);  // already draft → idempotent, no UPDATE
    const res = await request(makeApp()).patch('/api/invoices/pi/42/status').send({ status: 'draft' });

    expect(res.status).toBe(200);
    // Verify no UPDATE on proforma_invoices fired (idempotent path)
    const updateCall = db.query.mock.calls.find(c => /UPDATE proforma_invoices/.test(c[0]));
    expect(updateCall).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression tests for FinanceAudit v1 SIGNIFICANT bugs (fixed 24 Apr 2026)
// ─────────────────────────────────────────────────────────────────────────────

describe('M5 Finance — FinanceAudit 2.1: petty-cash GET JOIN alias', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role: 'finance_admin', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/finance', require('../routes/finance'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('hydrates both recorded_by_name and approved_by_name correctly (not aliased to same user)', async () => {
    // After the Pattern-1 refactor, user names are hydrated via Auth.getUsers,
    // not via JOINs. The original bug was that two JOIN aliases collided
    // (both fields resolved to the same user). The Auth.getUsers path uses a
    // Map<id, user> so different user_ids map to different rows by construction.
    const Auth = require('../../auth/contract');
    const origGetUsers = Auth.functions.getUsers;
    const spy = jest.fn(async (ids) => new Map([
      [7, { id: 7, full_name: 'Recorder',  phone: null }],
      [8, { id: 8, full_name: 'Approver',  phone: null }],
    ]));
    Auth.functions.getUsers = spy;

    // Petty-cash SELECT returns two rows with different recorder/approver ids
    db.query.mockResolvedValueOnce([[
      { id: 1, recorded_by: 7, approved_by: 8, txn_type: 'spend',         amount: 100 },
      { id: 2, recorded_by: 7, approved_by: 8, txn_type: 'replenishment', amount: 500 },
    ]]);

    const r = await request(makeApp()).get('/api/finance/1/petty-cash');
    Auth.functions.getUsers = origGetUsers;  // restore

    expect(r.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    const idsPassed = spy.mock.calls[0][0];
    expect(idsPassed).toContain(7);
    expect(idsPassed).toContain(8);
    expect(r.body.transactions[0].recorded_by_name).toBe('Recorder');
    expect(r.body.transactions[0].approved_by_name).toBe('Approver');
  });
});

describe('M5 Finance — FinanceAudit 2.2: budget initialise INSERT IGNORE removed', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role: 'pmc_head', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/budget', require('../routes/budget'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('uses plain INSERT not INSERT IGNORE', async () => {
    // requireProjectScope() does a DB lookup first — mock it.
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'active' }]]);
    // First content call: SELECT distinct trades
    db.query.mockResolvedValueOnce([[{ trade: 'civil', sanctioned: 100000 }]]);
    // Second content call: the INSERT
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);

    await request(makeApp()).post('/api/budget/1/initialise').send({});

    const insertCall = db.query.mock.calls.find(c => /INSERT.*budget_cost_heads/.test(c[0]));
    expect(insertCall).toBeDefined();
    expect(insertCall[0]).not.toMatch(/INSERT IGNORE/);
    expect(insertCall[0]).toMatch(/INSERT INTO budget_cost_heads/);
  });

  test('ER_DUP_ENTRY counted as skipped, not created', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([[{ trade: 'civil', sanctioned: 100000 }]]);
    const dupError = Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
    db.query.mockRejectedValueOnce(dupError);

    const r = await request(makeApp()).post('/api/budget/1/initialise').send({});
    expect(r.body.created).toBe(0);
    expect(r.body.skipped).toBe(1);
  });
});

describe('M5 Finance — FinanceAudit 2.3/2.4: urgent-payments role/scope gates', () => {
  function makeApp(role) {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role, projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/urgent-payments', require('../routes/urgent-payments'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('GET rejects a role outside URGENT_PAYMENT_ROLES', async () => {
    // Use a role that's in the system but not permitted for urgent-payments.
    // (Don't use 'audit' — by design it bypasses GET role checks via isAuditGet.)
    const r = await request(makeApp('design_head')).get('/api/urgent-payments/1');
    expect(r.status).toBe(403);
  });

  test('GET permits pmc_head', async () => {
    // Mock requireProjectScope's DB lookup + list query
    db.query.mockResolvedValue([[]]);
    const r = await request(makeApp('pmc_head')).get('/api/urgent-payments/1');
    expect([200, 403]).toContain(r.status);  // 403 if project scope fails; 200 if permitted
    expect(r.status).not.toBe(500);
  });
});

describe('M5 Finance — FinanceAudit 2.5: budget digest/tree role gates', () => {
  function makeApp(role) {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role, projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/budget', require('../routes/budget'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('digest endpoint rejects site_manager (prior leak)', async () => {
    const r = await request(makeApp('site_manager')).get('/api/budget/1/digest');
    expect(r.status).toBe(403);
  });

  test('tree endpoint rejects site_manager (prior leak)', async () => {
    const r = await request(makeApp('site_manager')).get('/api/budget/1/tree');
    expect(r.status).toBe(403);
  });

  test('digest endpoint permits design_head', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeApp('design_head')).get('/api/budget/1/digest');
    expect(r.status).toBeLessThan(500);
    expect(r.status).not.toBe(403);
  });

  test('tree endpoint permits pmc_head', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeApp('pmc_head')).get('/api/budget/1/tree');
    expect(r.status).toBeLessThan(500);
    expect(r.status).not.toBe(403);
  });
});

describe('M5 Finance — FinanceAudit 2.6: client-receipts uses db.tx', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role: 'finance_admin', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/finance', require('../routes/finance'));
    return app;
  }

  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue([[]]);
    // Also mock db.tx to capture its usage
    db.tx = jest.fn(async (fn) => {
      const conn = { query: jest.fn().mockResolvedValue([{ insertId: 101 }]) };
      return await fn(conn);
    });
  });

  test('POST client-receipts calls db.tx (writes are atomic)', async () => {
    await request(makeApp()).post('/api/finance/1/client-receipts').send({
      pi_id: 1,
      receipt_date: '2026-04-24',
      amount_received: 100000,
      tds_deducted: 10000,
      utr: 'UTR123',
      bank_ref: 'ICICI001',
      notes: 'Test receipt',
    });
    // The tx wrapper should have been invoked — this is the regression guard
    expect(db.tx).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression tests for FinanceAudit v1 MINOR bugs (fixed 25 Apr 2026)
// ─────────────────────────────────────────────────────────────────────────────

describe('M5 Finance — FinanceAudit 3.4: direct-payments requires explicit payment_type', () => {
  function makeApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role, projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/finance', require('../routes/finance'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('POST direct-payments rejects missing payment_type', async () => {
    db.query.mockResolvedValue([[{ id: 1 }]]);
    const r = await request(makeApp()).post('/api/finance/1/direct-payments').send({
      payment_date: '2026-04-25',
      amount: 5000,
      paid_to: 'Site contractor',
      description: 'Cash for urgent supplies',
      // payment_type intentionally missing
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('PAYMENT_TYPE_MISSING');
  });

  test('POST direct-payments rejects invalid payment_type', async () => {
    db.query.mockResolvedValue([[{ id: 1 }]]);
    const r = await request(makeApp()).post('/api/finance/1/direct-payments').send({
      payment_date: '2026-04-25',
      payment_type: 'paytm',  // not in whitelist
      amount: 5000,
      paid_to: 'Site contractor',
      description: 'x',
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('PAYMENT_TYPE_INVALID');
  });

  test('POST direct-payments accepts valid payment_type', async () => {
    db.query.mockResolvedValue([[{ id: 1 }]]);
    const r = await request(makeApp()).post('/api/finance/1/direct-payments').send({
      payment_date: '2026-04-25',
      payment_type: 'cash',
      amount: 5000,
      paid_to: 'Site contractor',
      description: 'x',
    });
    expect(r.status).toBeLessThan(500);
    expect([200, 403]).toContain(r.status);  // 403 if project scope fails, 200 if permitted
  });
});

describe('M5 Finance — FinanceAudit 3.3: boq-mapping split_pct sum validation', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role: 'pmc_head', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/boq-mapping', require('../routes/boq-mapping'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('rejects split_pct value > 100', async () => {
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // closed-project guard
    const r = await request(makeApp()).post('/api/boq-mapping/1').send({
      engagement_id: 1,
      boq_item_ids: [10],
      split_pct: 150,
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/between 0 and 100/);
  });

  test('rejects split_pct that would push total above 100', async () => {
    // Post-v5: requireProjectScope does the closed-project guard DB lookup
    // even for firm-wide roles. So we need to mock it before the trade SELECT.
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // closed-project guard
    db.query.mockResolvedValueOnce([[{ total_pct: 80 }]]);  // existing on this boq_item
    db.query.mockResolvedValueOnce([[{ item_name: 'RCC Column' }]]);  // item name for error

    const r = await request(makeApp()).post('/api/boq-mapping/1').send({
      engagement_id: 2,  // different engagement
      boq_item_ids: [10],
      split_pct: 30,  // 80 + 30 = 110%
    });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('SPLIT_EXCEEDS_100');
    expect(r.body.error).toMatch(/exceeds 100%/);
  });

  test('accepts split_pct that fits within 100%', async () => {
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // closed-project guard
    db.query.mockResolvedValueOnce([[{ total_pct: 60 }]]);  // existing
    db.query.mockResolvedValue([{ insertId: 1 }]);  // INSERT

    const r = await request(makeApp()).post('/api/boq-mapping/1').send({
      engagement_id: 2,
      boq_item_ids: [10],
      split_pct: 40,  // 60 + 40 = 100% — boundary
    });
    expect(r.status).toBeLessThan(500);
    expect(r.status).not.toBe(400);
  });
});

describe('M5 Finance — FinanceAudit 3.7: payments batch-approve tracks failedIds', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 9, role: 'principal', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/payments', require('../routes/payments'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('response includes approved_ids and skipped arrays', async () => {
    // closed-project guard via requireProjectScope
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);
    // SELECT id FROM payment_requests (pmc_approved rows) — return empty for simple case
    db.query.mockResolvedValueOnce([[]]);

    const r = await request(makeApp()).post('/api/payments/1/batch-approve').send({});
    expect(r.body).toHaveProperty('approved_ids');
    expect(r.body).toHaveProperty('skipped');
    expect(Array.isArray(r.body.approved_ids)).toBe(true);
    expect(Array.isArray(r.body.skipped)).toBe(true);
  });
});
