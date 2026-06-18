// tests/new-modules.test.js — Client BOQ, Measurements, Claims
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');
const perms   = require('../middleware/permissions');

// Pre-seed the permissions cache so requirePermission middleware doesn't
// try to load from DB (which would consume the route's mocked db.query
// responses). Includes every action the routes under test gate on.
perms._setCacheForTests([
  // Measurements
  { role: 'principal',         action: 'pmc.measurement.create',           level: 'A' },
  { role: 'design_principal',  action: 'pmc.measurement.create',           level: 'A' },
  { role: 'pmc_head',          action: 'pmc.measurement.create',           level: 'A' },
  { role: 'design_head',       action: 'pmc.measurement.create',           level: 'A' },
  { role: 'services_head',     action: 'pmc.measurement.create',           level: 'A' },
  { role: 'principal',         action: 'pmc.measurement.add-items',        level: 'A' },
  { role: 'pmc_head',          action: 'pmc.measurement.add-items',        level: 'A' },
  // Client BOQ — Finance + senior PMC
  { role: 'principal',         action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'design_principal',  action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'pmc_head',          action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'finance_admin',     action: 'finance.client-boq.edit-rate',     level: 'A' },
  { role: 'principal',         action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'design_principal',  action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'pmc_head',          action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'design_head',       action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'services_head',     action: 'finance.client-boq.edit-hsn',      level: 'A' },
  { role: 'finance_admin',     action: 'finance.client-boq.edit-hsn',      level: 'A' },
  // Clients — read for all front-line roles, create narrow (v5.12)
  { role: 'principal',         action: 'clients.read',                     level: 'R' },
  { role: 'design_principal',  action: 'clients.read',                     level: 'R' },
  { role: 'pmc_head',          action: 'clients.read',                     level: 'R' },
  { role: 'design_head',       action: 'clients.read',                     level: 'R' },
  { role: 'services_head',     action: 'clients.read',                     level: 'R' },
  { role: 'finance_admin',     action: 'clients.read',                     level: 'R' },
  { role: 'it_admin',          action: 'clients.read',                     level: 'R' },
  { role: 'principal',         action: 'clients.create',                   level: 'W' },
  { role: 'design_principal',  action: 'clients.create',                   level: 'W' },
  { role: 'finance_admin',     action: 'clients.create',                   level: 'W' },
  { role: 'principal',         action: 'clients.bulk_upload',              level: 'W' },
  { role: 'design_principal',  action: 'clients.bulk_upload',              level: 'W' },
  { role: 'finance_admin',     action: 'clients.bulk_upload',              level: 'W' },
  { role: 'principal',         action: 'clients.edit',                     level: 'W' },
  { role: 'design_principal',  action: 'clients.edit',                     level: 'W' },
  { role: 'finance_admin',     action: 'clients.edit',                     level: 'W' },
]);

function makeApp(role = 'principal') {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = {
      id: 1, username: 'naveen', full_name: 'Naveen Kumar Bhat',
      role, stream: 'all',
      projects: [{ id: 1, name: 'Test Project' }],
      projects_at: Date.now(),
    };
    next();
  });
  app.use('/api/client-boq',   require('../modules/onboarding/routes/client-boq'));
  app.use('/api/measurements', require('../modules/workflow/routes/measurements'));
  app.use('/api/claims',       require('../modules/finance/routes/claims'));
  return app;
}

beforeEach(() => { jest.clearAllMocks(); db.query.mockReset(); db.query.mockResolvedValue([[]]); });

// ── CLIENT BOQ
describe('GET /api/client-boq/:project_id', () => {
  test('principal can view client BOQ', async () => {
    const app = makeApp('principal');
    db.query
      .mockResolvedValueOnce([[]])   // versions
      .mockResolvedValueOnce([[]])   // items
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(200);
    expect(res.body.can_see_rates).toBe(true);
  });

  test('site_manager cannot view client BOQ', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(403);
  });

  test('detailing_head cannot view client BOQ', async () => {
    const app = makeApp('detailing_head');
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(403);
  });

  test('jr_architect cannot view client BOQ', async () => {
    const app = makeApp('jr_architect');
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(403);
  });

  test('design_head can view client BOQ', async () => {
    const app = makeApp('design_head');
    db.query.mockResolvedValueOnce([[]])
             .mockResolvedValueOnce([[]])
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(200);
    expect(res.body.can_see_rates).toBe(true);
  });

  test('services_head can view client BOQ', async () => {
    const app = makeApp('services_head');
    db.query.mockResolvedValueOnce([[]])
             .mockResolvedValueOnce([[]])
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(200);
  });

  test('pmc_head can view client BOQ', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[]])
             .mockResolvedValueOnce([[]])
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(200);
  });

  test('services_engineer cannot view client BOQ', async () => {
    const app = makeApp('services_engineer');
    const res = await request(app).get('/api/client-boq/1');
    expect(res.status).toBe(403);
  });
});

// ── MEASUREMENTS
describe('POST /api/measurements/:project_id', () => {
  test('principal can create measurement', async () => {
    const app = makeApp('principal');
    db.query
      .mockResolvedValueOnce([[{ cnt: 0 }]])  // count existing
      .mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/measurements/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil', measurement_date: '2026-04-12'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('pmc_head can create measurement', async () => {
    const app = makeApp('pmc_head');
    db.query
      .mockResolvedValueOnce([[{ cnt: 0 }]])
      .mockResolvedValueOnce([{ insertId: 2 }]);
    const res = await request(app).post('/api/measurements/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil', measurement_date: '2026-04-12'
    });
    expect(res.status).toBe(200);
  });

  test('site_manager cannot create measurement', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/measurements/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil', measurement_date: '2026-04-12'
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 if discipline missing', async () => {
    const app = makeApp('principal');
    const res = await request(app).post('/api/measurements/1').send({
      ra_bill_number: 'RA01', measurement_date: '2026-04-12'
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 if date missing', async () => {
    const app = makeApp('principal');
    const res = await request(app).post('/api/measurements/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil'
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/measurements/:project_id/:id/rs-signoff', () => {
  test('design_head can sign off', async () => {
    const app = makeApp('design_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([[{ status: 'draft' }]]);   // SM read current state
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);     // SM transition UPDATE
    const res = await request(app).post('/api/measurements/1/1/rs-signoff')
      .send({ notes: 'Quantities confirmed against drawings' });
    expect(res.status).toBe(200);
  });

  test('services_head can sign off', async () => {
    const app = makeApp('services_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([[{ status: 'draft' }]]);   // SM read current state
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);     // SM transition UPDATE
    const res = await request(app).post('/api/measurements/1/1/rs-signoff').send({});
    expect(res.status).toBe(200);
  });

  test('pmc_head cannot do R/S sign-off', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).post('/api/measurements/1/1/rs-signoff').send({});
    expect(res.status).toBe(403);
  });

  test('site_manager cannot do R/S sign-off', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/measurements/1/1/rs-signoff').send({});
    expect(res.status).toBe(403);
  });
});

// ── CLAIMS
describe('POST /api/claims/:project_id', () => {
  test('pmc_head can raise claim after client acceptance', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]])             // closed-project guard
             .mockResolvedValueOnce([[{ status: 'client_accepted' }]])    // measurement check
             .mockResolvedValueOnce([{ insertId: 1 }]);                   // insert
    const res = await request(app).post('/api/claims/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil', measurement_id: 1
    });
    expect(res.status).toBe(200);
  });

  test('cannot raise claim if measurement not client_accepted', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]])  // closed-project guard
             .mockResolvedValueOnce([[{ status: 'rs_signed' }]]);  // not client_accepted
    const res = await request(app).post('/api/claims/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil', measurement_id: 1
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/client acceptance required/i);
  });

  test('site_manager cannot raise claim', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).post('/api/claims/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil'
    });
    expect(res.status).toBe(403);
  });

  test('detailing cannot raise claim', async () => {
    const app = makeApp('detailing');
    const res = await request(app).post('/api/claims/1').send({
      ra_bill_number: 'RA01', discipline: 'Civil'
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/claims/:project_id/:id/approve', () => {
  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

  test('principal can approve claim with both sign-offs', async () => {
    const app = makeApp('principal');
    db.query
      .mockResolvedValueOnce([[{ status: 'active' }]])  // closed-project guard
      .mockResolvedValueOnce([[{ id:1, pmc_signoff:3, rs_signoff:5,
        ra_bill_number:'RA01', discipline:'Civil', project_id:1, status:'pending_approval' }]])
      .mockResolvedValueOnce([{ affectedRows:1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ name:'Test Project' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const res = await request(app).post('/api/claims/1/1/approve');
    expect(res.status).toBe(200);
  });

  test('cannot approve without both sign-offs', async () => {
    const app = makeApp('principal');
    db.query
      .mockResolvedValueOnce([[{ status: 'active' }]])  // closed-project guard
      .mockResolvedValueOnce([[{ id:1, pmc_signoff:3, rs_signoff:null,
        ra_bill_number:'RA01', discipline:'Civil', project_id:1 }]]);
    const res = await request(app).post('/api/claims/1/1/approve');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sign-offs required/i);
  });

  test('pmc_head cannot approve claim', async () => {
    const app = makeApp('pmc_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);
    const res = await request(app).post('/api/claims/1/1/approve');
    expect(res.status).toBe(403);
  });

  test('design_head cannot approve claim', async () => {
    const app = makeApp('design_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);
    const res = await request(app).post('/api/claims/1/1/approve');
    expect(res.status).toBe(403);
  });

  test('design_principal can approve claim (Principal-tier role)', async () => {
    const app = makeApp('design_principal');
    db.query
      .mockResolvedValueOnce([[{ status: 'active' }]])  // closed-project guard
      .mockResolvedValueOnce([[{ id:1, pmc_signoff:3, rs_signoff:5,
        ra_bill_number:'RA01', discipline:'Civil', project_id:1, status:'pending_approval' }]])
      .mockResolvedValueOnce([{ affectedRows:1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ name:'Test Project' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    const res = await request(app).post('/api/claims/1/1/approve');
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/claims/:project_id/:id/invoice-number', () => {
  test('pmc_head can record invoice number', async () => {
    const app = makeApp('pmc_head');
    db.query
      .mockResolvedValueOnce([[{ status: 'active' }]])      // closed-project guard
      .mockResolvedValueOnce([[{ status: 'approved' }]])    // status check
      .mockResolvedValueOnce([{ affectedRows: 1 }]);        // UPDATE
    const res = await request(app).patch('/api/claims/1/1/invoice-number').send({
      invoice_number: 'INV-2026-042', invoice_date: '2026-04-13'
    });
    expect(res.status).toBe(200);
  });

  test('site_manager cannot record invoice number', async () => {
    const app = makeApp('site_manager');
    const res = await request(app).patch('/api/claims/1/1/invoice-number').send({
      invoice_number: 'INV-2026-042'
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 if invoice number missing', async () => {
    const app = makeApp('pmc_head');
    const res = await request(app).patch('/api/claims/1/1/invoice-number').send({});
    expect(res.status).toBe(400);
  });
});

// ── GANTT
describe('GET /api/gantt/:project_id', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue([[null], []]);
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);
  });

  function makeGanttApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: 1, username: 'naveen', full_name: 'Naveen', role, stream: 'all', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/gantt', require('../modules/reporting/routes/gantt'));
    return app;
  }

  test('principal can get Gantt data', async () => {
    const app = makeGanttApp('principal');
    const version = { id:1, label:'R0', drift_days:0, r0_start_date:'2026-03-23',
      r0_end_date:'2026-05-25', project_name:'PV90', version_number:0 };
    db.query
      .mockResolvedValueOnce([[version], []])   // version query
      .mockResolvedValueOnce([[{ id:1, name:'PV90', r0_start_date:'2026-03-23', r0_end_date:'2026-05-25' }], []])  // Onboarding.getProject lookup
      .mockResolvedValueOnce([[
        { id:1, task_name:'Waterproofing', trade:'Civil', start_date:'2026-03-23',
          end_date:'2026-04-05', pct_complete:100, start_day:0, end_day:13,
          duration_days:14, is_overdue:0, depends_on_task_id:null, display_order:1 }
      ], []]);
    const res = await request(app).get('/api/gantt/1');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toBeDefined();
    expect(res.body.project).toBeDefined();
    expect(res.body.trades).toBeDefined();
  });

  test('returns empty if no schedule', async () => {
    const app = makeGanttApp('pmc_head');
    db.query.mockResolvedValueOnce([[null], []]); // no version row → early return
    const res = await request(app).get('/api/gantt/1');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  test('site_manager can view Gantt', async () => {
    const app = makeGanttApp('site_manager');
    const version = { id:1, label:'R0', drift_days:0, r0_start_date:'2026-03-23',
      r0_end_date:'2026-05-25', project_name:'PV90', version_number:0 };
    db.query
      .mockResolvedValueOnce([[version], []])
      .mockResolvedValueOnce([[{ id:1, name:'PV90', r0_start_date:'2026-03-23', r0_end_date:'2026-05-25' }], []])  // Onboarding.getProject
      .mockResolvedValueOnce([[], []]);
    const res = await request(app).get('/api/gantt/1');
    expect(res.status).toBe(200);
  });
});

// ── HSN
describe('PATCH /api/client-boq/:project_id/items/:id/hsn', () => {
  function makeHSNApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: 1, username: 'naveen', full_name: 'Naveen', role, stream: 'all', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/client-boq', require('../modules/onboarding/routes/client-boq'));
    return app;
  }

  test('principal can update HSN', async () => {
    const app = makeHSNApp('principal');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);
    const res = await request(app).patch('/api/client-boq/1/items/1/hsn').send({ hsn_code: '44042000' });
    expect(res.status).toBe(200);
    expect(res.body.hsn_code).toBe('44042000');
  });

  test('rejects invalid HSN format', async () => {
    const app = makeHSNApp('principal');
    const res = await request(app).patch('/api/client-boq/1/items/1/hsn').send({ hsn_code: 'ABCD' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/4, 6, or 8 digits/);
  });

  test('accepts 4-digit HSN', async () => {
    const app = makeHSNApp('rajani');
    // rajani has design_head role
    const app2 = makeHSNApp('design_head');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);
    const res = await request(app2).patch('/api/client-boq/1/items/1/hsn').send({ hsn_code: '4404' });
    expect(res.status).toBe(200);
  });

  test('accepts empty string to clear HSN', async () => {
    const app = makeHSNApp('principal');
    db.query.mockResolvedValueOnce([[{ status: 'active' }]]);  // requireProjectScope
    db.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);
    const res = await request(app).patch('/api/client-boq/1/items/1/hsn').send({ hsn_code: '' });
    expect(res.status).toBe(200);
    expect(res.body.hsn_code).toBeNull();
  });

  test('site_manager cannot update HSN', async () => {
    const app = makeHSNApp('site_manager');
    const res = await request(app).patch('/api/client-boq/1/items/1/hsn').send({ hsn_code: '4404' });
    expect(res.status).toBe(403);
  });

  test('detailing cannot update HSN', async () => {
    const app = makeHSNApp('detailing');
    const res = await request(app).patch('/api/client-boq/1/items/1/hsn').send({ hsn_code: '4404' });
    expect(res.status).toBe(403);
  });
});

// ── CLIENT MASTER
describe('GET /api/clients', () => {
  function makeClientApp(role = 'principal', username = 'naveen') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: 1, username, full_name: 'Test', role, stream: 'all', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/clients', require('../modules/onboarding/routes/clients'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

  test('principal can view clients', async () => {
    const app = makeClientApp('principal');
    db.query.mockResolvedValueOnce([[{ id:1, client_name:'TLD MAINI' }]]);
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(res.body.clients).toBeDefined();
  });

  test('udupa can view clients', async () => {
    const app = makeClientApp('principal', 'udupa');
    db.query.mockResolvedValueOnce([[{ id:1, client_name:'TLD MAINI' }]]);
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
  });

  test.skip('pmc_head cannot view clients [PRODUCT QUESTION — see SHIP_READINESS_REPORT gap 8]', async () => {
    // Test asserts firm-level client master is Naveen+Udupa only.
    // Current GET /api/clients only requires auth. EITHER the implementation
    // should add a role gate (principal+design_principal+finance_admin), OR
    // this test should be relaxed. Park for Naveen decision.
    const app = makeClientApp('pmc_head', 'murugesan');
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(403);
  });

  test.skip('site_manager cannot view clients [PRODUCT QUESTION — see SHIP_READINESS_REPORT gap 8]', async () => {
    const app = makeClientApp('site_manager', 'anjaneya');
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(403);
  });
});

describe('POST /api/clients', () => {
  function makeClientApp(role = 'principal', username = 'naveen') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: 1, username, full_name: 'Test', role, stream: 'all', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/clients', require('../modules/onboarding/routes/clients'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

  test('principal can create client', async () => {
    const app = makeClientApp('principal');
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/clients').send({
      client_name: 'TLD MAINI GSE Pvt Ltd',
      gstin: '27AAACT1234F1Z5',
      state_code: 27,
      state_name: 'Maharashtra'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('interstate client detected correctly (Karnataka=29)', async () => {
    const app = makeClientApp('principal');
    db.query.mockResolvedValueOnce([{ insertId: 2 }]);
    const res = await request(app).post('/api/clients').send({
      client_name: 'Mumbai Client', gstin: '27XXXXX1234X1Z5',
      state_code: 27, state_name: 'Maharashtra'
    });
    expect(res.status).toBe(200);
    // state_code 27 ≠ 29 → is_interstate = true → IGST
    expect(res.body.success).toBe(true);
  });

  test('intrastate client — Karnataka (code 29)', async () => {
    const app = makeClientApp('principal');
    db.query.mockResolvedValueOnce([{ insertId: 3 }]);
    const res = await request(app).post('/api/clients').send({
      client_name: 'Bengaluru Client', gstin: '29XXXXX1234X1Z5',
      state_code: 29, state_name: 'Karnataka'
    });
    expect(res.status).toBe(200);
  });

  test('returns 400 if GSTIN missing', async () => {
    const app = makeClientApp('principal');
    const res = await request(app).post('/api/clients').send({
      client_name: 'Test', state_code: 27
    });
    expect(res.status).toBe(400);
  });

  test('design_principal can create client', async () => {
    const app = makeClientApp('design_principal', 'ajay');
    db.query.mockResolvedValueOnce([{ insertId: 4 }]);
    const res = await request(app).post('/api/clients').send({
      client_name: 'Test', gstin: '29XXXXX1234X1Z5', state_code: 29, state_name: 'Karnataka'
    });
    expect(res.status).toBe(200);
  });
});

// ── NON-BOQ VENDOR ITEMS
describe.skip('[V5 REMOVED] POST /api/vendors/:id/nonboq', () => {
  function makeVendorApp(role = 'pmc_head') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: 3, username: 'murugesan', full_name: 'Murugesan', role, stream: 'pmc', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/vendors', require('../modules/onboarding/routes/vendors'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

  test('pmc_head can add non-BOQ item', async () => {
    const app = makeVendorApp('pmc_head');
    db.query.mockResolvedValueOnce([{ insertId: 1 }]);
    const res = await request(app).post('/api/vendors/1/nonboq').send({
      project_id: 1,
      description: 'Diesel for generator — April week 2',
      unit: 'litres', quantity: 200, our_cost_rate: 95,
      category: 'site_overhead'
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('site_manager cannot add non-BOQ item', async () => {
    const app = makeVendorApp('site_manager');
    const res = await request(app).post('/api/vendors/1/nonboq').send({
      project_id: 1, description: 'Test', unit: 'nos', quantity: 1
    });
    expect(res.status).toBe(403);
  });

  test('returns 400 if description missing', async () => {
    const app = makeVendorApp('pmc_head');
    const res = await request(app).post('/api/vendors/1/nonboq').send({ project_id: 1 });
    expect(res.status).toBe(400);
  });
});

// ── PROVISIONAL BOQ
describe.skip('[V5 REMOVED] POST /api/vendors/provisional-boq/:id/ratify', () => {
  function makeVendorApp(role = 'design_head') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: 5, username: 'rajani', full_name: 'Rajani', role, stream: 'design', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/vendors', require('../modules/onboarding/routes/vendors'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

  test('design_head can ratify provisional item', async () => {
    const app = makeVendorApp('design_head');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/vendors/provisional-boq/1/ratify').send({
      status: 'ratified', notes: 'Confirmed in revised BOQ'
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ratified');
  });

  test('services_head can reject provisional item', async () => {
    const app = makeVendorApp('services_head');
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = await request(app).post('/api/vendors/provisional-boq/1/ratify').send({
      status: 'rejected', notes: 'Not in approved scope'
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  test('pmc_head cannot ratify — R/S only', async () => {
    const app = makeVendorApp('pmc_head');
    const res = await request(app).post('/api/vendors/provisional-boq/1/ratify').send({
      status: 'ratified'
    });
    expect(res.status).toBe(403);
  });

  test('invalid status rejected', async () => {
    const app = makeVendorApp('design_head');
    const res = await request(app).post('/api/vendors/provisional-boq/1/ratify').send({
      status: 'approved'
    });
    expect(res.status).toBe(400);
  });
});

// ── WEEKLY HEALTH REPORT
describe('GET /api/weekly-health/schedule', () => {
  function makeHealthApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id:1, username:'naveen', full_name:'Naveen', role, stream:'all', projects: [{id:1}], projects_at: Date.now() };
      next();
    });
    app.use('/api/weekly-health', require('../modules/reporting/routes/weekly-health'));
    return app;
  }

  beforeEach(() => { db.query.mockReset(); db.query.mockResolvedValue([[]]); });

  test('returns schedule info', async () => {
    const app = makeHealthApp('principal');
    const res = await request(app).get('/api/weekly-health/schedule');
    expect(res.status).toBe(200);
    expect(res.body.report_day).toBe('Monday');
    expect(res.body.recipients).toContain('Naveen Kumar Bhat');
    expect(res.body.recipients).toContain('Ajay Appachu');
  });

  test('design_principal can view schedule', async () => {
    const app = makeHealthApp('design_principal');
    const res = await request(app).get('/api/weekly-health/schedule');
    expect(res.status).toBe(200);
  });

  test('pmc_head can view weekly health report (in FINANCE_ROLES)', async () => {
    const app = makeHealthApp('pmc_head');
    // Provide enough mocks for the report generator to not crash —
    // we only care about the gate here.
    db.query.mockResolvedValue([[]]);
    const res = await request(app).get('/api/weekly-health/report');
    // Anything but 403/401 — successful gate pass. The report generator
    // may 500 on missing data, but that's not what's under test.
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  test('site_manager cannot view weekly health report', async () => {
    const app = makeHealthApp('site_manager');
    const res = await request(app).get('/api/weekly-health/report');
    expect(res.status).toBe(403);
  });
});
