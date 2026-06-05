// tests/invoice-concurrency.test.js — Concurrency tests for invoice sequence generation
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const db      = require('../middleware/db');
const perms   = require('../middleware/permissions');

// Helper to construct pre-authenticated app
function makeApp(role = 'principal', extraRoutes = []) {
  // Seed the permissions cache so that requireAuth / can check passes
  perms._setCacheForTests([
    { role: 'principal', action: 'clients.create', level: 'A' }
  ]);

  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));

  app.use((req, _res, next) => {
    req.session.user = {
      id: 1,
      username: 'testuser',
      full_name: 'Test User',
      role,
      stream: 'all',
      projects: [{ id: 1, name: 'Test Project' }],
      projects_at: Date.now(),
    };
    next();
  });

  extraRoutes.forEach(([path, router]) => app.use(path, router));
  return app;
}

describe('Invoice Sequence Generation Concurrency & Safety', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  test('POST /api/clients/:id/tally-xml/:claim_id executes within a transaction and uses FOR UPDATE row locking', async () => {
    app = makeApp('principal', [['/api/clients', require('../modules/onboarding/routes/clients')]]);

    // Mock sequence of database calls:
    // 1. SELECT * FROM clients WHERE id = ?
    db.query.mockResolvedValueOnce([[{
      id: 5,
      client_name: 'Client A',
      invoice_prefix: 'CL-A/',
      invoice_sequence: 10,
      is_interstate: 0,
    }]]);

    // 2. SELECT cl.*, p.name AS project_name, p.code AS project_code FROM client_claims cl ...
    db.query.mockResolvedValueOnce([[{
      id: 20,
      project_id: 1,
      project_name: 'Project A',
      project_code: 'PA',
      ra_bill_number: 'RA-01',
      discipline: 'Civil',
      status: 'approved',
    }]]);

    // 3. SELECT cli.claimed_qty, cb.item_name ... FROM claim_items cli
    db.query.mockResolvedValueOnce([[
      { claimed_qty: 2, item_name: 'Item 1', unit: 'sqm', client_rate: 1500, line_amount: 3000 }
    ]]);

    // Now queries inside db.tx transaction block:
    // 4. SELECT invoice_sequence, invoice_prefix FROM clients WHERE id = ? FOR UPDATE
    db.query.mockResolvedValueOnce([[{
      invoice_sequence: 10,
      invoice_prefix: 'CL-A/',
    }]]);

    // 5. UPDATE clients SET invoice_sequence = ? WHERE id = ?
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    // 6. UPDATE client_claims SET invoice_number = ?, invoice_sequence = ? WHERE id = ?
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    // 7. Insert audit log / notifications (if any db queries are performed)
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    // Spy on db.tx to ensure transaction mode is activated
    const txSpy = jest.spyOn(db, 'tx');

    const res = await request(app)
      .post('/api/clients/5/tally-xml/20')
      .send({});

    // Check response status
    expect(res.status).toBe(200);

    // Verify transaction block was executed
    expect(txSpy).toHaveBeenCalledTimes(1);

    // Verify correct queries were sent to db.query in correct sequence
    const queries = db.query.mock.calls.map(call => call[0]);

    // Verify row locking is performed
    const lockQuery = queries.find(q => typeof q === 'string' && q.includes('FOR UPDATE'));
    expect(lockQuery).toBeDefined();
    expect(lockQuery).toContain('SELECT invoice_sequence, invoice_prefix FROM clients WHERE id = ? FOR UPDATE');

    // Verify the invoice sequence updates
    const clientUpdateQuery = queries.find(q => typeof q === 'string' && q.includes('UPDATE clients SET invoice_sequence'));
    expect(clientUpdateQuery).toBeDefined();

    const claimUpdateQuery = queries.find(q => typeof q === 'string' && q.includes('UPDATE client_claims SET invoice_number'));
    expect(claimUpdateQuery).toBeDefined();

    txSpy.mockRestore();
  });
});
