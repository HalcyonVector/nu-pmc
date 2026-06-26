// modules/onboarding/tests/vendor-public.test.js
// ════════════════════════════════════════════════════════════════════════════
// Tests for:
//   - GET  /vendor-onboard/:token            (public, render form HTML)
//   - POST /vendor-onboard/:token/confirm    (public, vendor confirms)
//   - POST /vendor-onboard/:token/reject     (public, vendor rejects)
//   - POST /api/vendors/master/:id/onboard-link  (internal, issues token)
// Database mocked.
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

const db = require('../../../middleware/db');
const perms = require('../../../middleware/permissions');
perms._setCacheForTests([
  { role: 'finance_admin',     action: 'admin.vendor.update', level: 'W' },
  { role: 'pmc_head',          action: 'admin.vendor.update', level: 'W' },
  { role: 'design_head',       action: 'admin.vendor.update', level: 'W' },
  { role: 'services_head',     action: 'admin.vendor.update', level: 'W' },
  { role: 'principal',         action: 'admin.vendor.update', level: 'A' },
  { role: 'design_principal',  action: 'admin.vendor.update', level: 'A' },
  // For the internal onboard-link tests that piggyback on V8's perms
  { role: 'finance_admin',     action: 'admin.vendor.bank-change.propose', level: 'W' },
  { role: 'principal',         action: 'admin.vendor.bank-change.approve', level: 'A' },
]);

function makeInternalApp(user) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = {
      id: user.id, username: `user${user.id}`,
      full_name: user.full_name || 'Test',
      role: user.role, stream: 'all',
      projects: [], projects_at: Date.now(),
    };
    next();
  });
  app.use('/api/vendors', require('../routes/vendors'));
  return app;
}

function makePublicApp() {
  // Public route — NO session, NO auth. Mounted at /vendor-onboard.
  const app = express();
  app.use(express.json());
  app.use('/vendor-onboard', require('../routes/vendor-public'));
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
});

// ── INTERNAL: POST /api/vendors/master/:id/onboard-link ─────────────────────

describe('POST /api/vendors/master/:id/onboard-link — issues token', () => {
  test('returns wa_url + public_url for purpose=onboard', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query
      // 1. SELECT vendor (route handler)
      .mockResolvedValueOnce([[{
        id: 5, vendor_name: 'Acme', phone: '+919876543210',
        bank_name: 'HDFC', bank_account: '12345', bank_ifsc: 'HDFC0000001',
      }]])
      // 2. service.issue tx callback — revoke prior tokens
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      // 3. service.issue tx callback — INSERT new token row
      .mockResolvedValueOnce([{ insertId: 100 }]);

    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'onboard' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.wa_url).toContain('wa.me/919876543210');
    expect(res.body.public_url).toContain('/vendor-onboard/');
    expect(res.body.expires_at).toBeDefined();
    // Phone returned matches the vendor's primary
    expect(res.body.vendor_phone).toBe('+919876543210');
  });

  test('uses contact_role to pick alternate phone when provided', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query
      // SELECT vendor
      .mockResolvedValueOnce([[{
        id: 5, vendor_name: 'Acme', phone: '+919876543210',
        bank_name: 'HDFC', bank_account: '1', bank_ifsc: 'I',
      }]])
      // SELECT vendor_contacts.phone for accounts role
      .mockResolvedValueOnce([[{ phone: '+919998887777' }]])
      // service.issue: revoke prior
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      // service.issue: INSERT
      .mockResolvedValueOnce([{ insertId: 101 }]);

    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'onboard', contact_role: 'accounts' });

    expect(res.status).toBe(200);
    expect(res.body.wa_url).toContain('wa.me/919998887777');
    expect(res.body.vendor_phone).toBe('+919998887777');
  });

  test('returns 404 when vendor not found', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query.mockResolvedValueOnce([[]]);  // SELECT vendor returns nothing

    const res = await request(app)
      .post('/api/vendors/master/999/onboard-link')
      .send({ purpose: 'onboard' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 400 when vendor has no phone on file', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query.mockResolvedValueOnce([[{
      id: 5, vendor_name: 'Acme', phone: null,
      bank_name: 'HDFC', bank_account: '1', bank_ifsc: 'I',
    }]]);

    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'onboard' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NO_PHONE');
  });

  test('returns 400 when phone exists but is unparseable for wa.me', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query
      .mockResolvedValueOnce([[{
        id: 5, vendor_name: 'Acme', phone: 'not-a-number-789',
        bank_name: 'HDFC', bank_account: '1', bank_ifsc: 'I',
      }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([{ insertId: 102 }]);

    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'onboard' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PHONE_INVALID');
  });

  test('rejects without admin.vendor.update perm', async () => {
    const app = makeInternalApp({ id: 9, role: 'site_manager' });
    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'onboard' });
    expect(res.status).toBe(403);
  });

  test('purpose=bank_confirm requires approval_id', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query.mockResolvedValueOnce([[{
      id: 5, vendor_name: 'Acme', phone: '+919876543210',
      bank_name: 'HDFC', bank_account: '1', bank_ifsc: 'I',
    }]]);

    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'bank_confirm' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('APPROVAL_REQUIRED');
  });

  test('purpose=bank_confirm validates the approval row is pending', async () => {
    const app = makeInternalApp({ id: 9, role: 'finance_admin' });
    db.query
      // vendor
      .mockResolvedValueOnce([[{
        id: 5, vendor_name: 'Acme', phone: '+919876543210',
        bank_name: 'HDFC', bank_account: '1', bank_ifsc: 'I',
      }]])
      // approval row — already approved, not pending
      .mockResolvedValueOnce([[{
        before_bank_name: 'HDFC', before_bank_account: '1', before_bank_ifsc: 'I',
        after_bank_name:  'ICICI', after_bank_account:  '2', after_bank_ifsc:  'I2',
        status: 'approved',
      }]]);

    const res = await request(app)
      .post('/api/vendors/master/5/onboard-link')
      .send({ purpose: 'bank_confirm', approval_id: 50 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('APPROVAL_NOT_PENDING');
  });
});

// ── PUBLIC: GET /vendor-onboard/:token ──────────────────────────────────────

describe('GET /vendor-onboard/:token — render form', () => {
  function lookupResolves(overrides = {}) {
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'issued', purpose: 'onboard',
      expires_at: new Date(Date.now() + 3600_000),
      payload_json: null, approval_id: null,
      vendor_name: 'Acme Civil', vendor_phone: '+919876543210',
      bank_name: 'HDFC', bank_account: '12345', bank_ifsc: 'HDFC0000001',
      gst_number: '29ABCDE1234F1Z5', pan_number: 'ABCDE1234F',
      clearance_status: 'pending', bank_validated_by_vendor: 0,
      ...overrides,
    }]]);
  }

  test('valid token: renders form HTML with vendor name', async () => {
    const app = makePublicApp();
    lookupResolves();
    // recordOpen: SELECT cur token
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'issued', open_count: 0 }]]);
    // recordOpen: bump open_count
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // recordOpen: mark opened (real-browser path)
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .get('/vendor-onboard/' + 'a'.repeat(64))
      .set('User-Agent', 'Mozilla/5.0 Chrome/120')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.text).toContain('Acme Civil');
    // Both action buttons rendered
    expect(res.text).toContain('btn-confirm');
    expect(res.text).toContain('btn-reject');
  });

  test('expired token: returns 410 with friendly error', async () => {
    const app = makePublicApp();
    lookupResolves({ expires_at: new Date(Date.now() - 1000) });
    // recordOpen still fires (best-effort): SELECT cur
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'issued', open_count: 0 }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .get('/vendor-onboard/' + 'b'.repeat(64))
      .set('User-Agent', 'Mozilla/5.0 Chrome/120')
      .set('Accept', 'text/html');

    expect(res.status).toBe(410);
    expect(res.text).toMatch(/expired/i);
    // Form NOT rendered — no button element with that id
    expect(res.text).not.toMatch(/id="btn-confirm"/);
  });

  test('consumed token: 200 with already-confirmed message', async () => {
    const app = makePublicApp();
    lookupResolves({ status: 'consumed' });
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'consumed', open_count: 5 }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .get('/vendor-onboard/' + 'c'.repeat(64))
      .set('User-Agent', 'Mozilla/5.0 Chrome/120')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/already (confirmed|responded)/i);
    expect(res.text).not.toMatch(/id="btn-confirm"/);
  });

  test('malformed token: 404', async () => {
    const app = makePublicApp();
    const res = await request(app).get('/vendor-onboard/not-hex');
    expect(res.status).toBe(404);
  });

  test('bank_confirm purpose: shows before/after bank fields', async () => {
    const app = makePublicApp();
    lookupResolves({
      purpose: 'bank_confirm',
      payload_json: JSON.stringify({
        before: { bank_name: 'HDFC', bank_account: 'OLD123', bank_ifsc: 'HDFC0000001' },
        after:  { bank_name: 'ICICI', bank_account: 'NEW999', bank_ifsc: 'ICIC0000001' },
      }),
      approval_id: 77,
    });
    db.query.mockResolvedValueOnce([[{ id: 1, status: 'issued', open_count: 0 }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await request(app)
      .get('/vendor-onboard/' + 'd'.repeat(64))
      .set('User-Agent', 'Mozilla/5.0 Chrome/120')
      .set('Accept', 'text/html');

    expect(res.status).toBe(200);
    // After value visible (renders with the new account no.)
    expect(res.text).toContain('NEW999');
    // Before value also visible (smaller "Was:" label)
    expect(res.text).toContain('OLD123');
    // "changed" class applied to a value cell
    expect(res.text).toMatch(/value changed/);
  });
});

// ── PUBLIC: POST /vendor-onboard/:token/confirm + /reject ────────────────────

describe('POST /vendor-onboard/:token/confirm — vendor confirms', () => {
  function consumeMocks({ purpose = 'bank_confirm', approval_id = 77 } = {}) {
    // 1. lookup SELECT
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'opened', purpose,
      expires_at: new Date(Date.now() + 3600_000),
      payload_json: JSON.stringify({ before: {}, after: {} }),
      approval_id,
      vendor_name: 'Acme', vendor_phone: '+91',
      bank_name: 'B', bank_account: '1', bank_ifsc: 'I',
      gst_number: null, pan_number: null,
      clearance_status: 'pending', bank_validated_by_vendor: 0,
    }]]);
    // 2. consume UPDATE
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
  }

  test('bank_confirm/confirm: marks vendor validated, emits alert', async () => {
    const app = makePublicApp();
    consumeMocks({ purpose: 'bank_confirm', approval_id: 77 });
    // tx: UPDATE vendors
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // tx: INSERT vendor_alerts
    db.query.mockResolvedValueOnce([{ insertId: 200 }]);

    const res = await request(app)
      .post('/vendor-onboard/' + 'a'.repeat(64) + '/confirm');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Alert payload includes approval_id
    const alertCall = db.query.mock.calls.find(c => /INSERT INTO vendor_alerts/.test(c[0]));
    expect(alertCall).toBeDefined();
    expect(alertCall[1][1]).toBe('bank_change.vendor_confirmed');
    const payload = JSON.parse(alertCall[1][2]);
    expect(payload.approval_id).toBe(77);
    expect(payload.method).toBe('wa_form');
    // Vendor UPDATE sets bank_validated_by_vendor=1
    const venCall = db.query.mock.calls.find(c => /UPDATE vendors/.test(c[0]));
    expect(venCall).toBeDefined();
    expect(venCall[0]).toMatch(/bank_validated_by_vendor = 1/);
  });

  test('onboard/confirm: emits onboard.confirmed alert', async () => {
    const app = makePublicApp();
    consumeMocks({ purpose: 'onboard' });
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);   // UPDATE vendors
    db.query.mockResolvedValueOnce([{ insertId: 201 }]);     // INSERT alert

    const res = await request(app)
      .post('/vendor-onboard/' + 'b'.repeat(64) + '/confirm');

    expect(res.status).toBe(200);
    const alertCall = db.query.mock.calls.find(c => /INSERT INTO vendor_alerts/.test(c[0]));
    expect(alertCall[1][1]).toBe('onboard.confirmed');
  });

  test('expired token: rejects with 410', async () => {
    const app = makePublicApp();
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'issued', purpose: 'bank_confirm',
      expires_at: new Date(Date.now() - 1000),
      payload_json: null, approval_id: null,
      vendor_name: 'A', vendor_phone: '+91',
      bank_name: 'B', bank_account: '1', bank_ifsc: 'I',
      gst_number: null, pan_number: null,
      clearance_status: 'pending', bank_validated_by_vendor: 0,
    }]]);

    const res = await request(app)
      .post('/vendor-onboard/' + 'c'.repeat(64) + '/confirm');

    expect(res.status).toBe(410);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });
});

describe('POST /vendor-onboard/:token/reject — vendor rejects', () => {
  test('bank_confirm/reject: emits vendor_rejected alert, no vendor update', async () => {
    const app = makePublicApp();
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'opened', purpose: 'bank_confirm',
      expires_at: new Date(Date.now() + 3600_000),
      payload_json: JSON.stringify({}), approval_id: 77,
      vendor_name: 'A', vendor_phone: '+91',
      bank_name: 'B', bank_account: '1', bank_ifsc: 'I',
      gst_number: null, pan_number: null,
      clearance_status: 'pending', bank_validated_by_vendor: 0,
    }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);   // consume UPDATE
    db.query.mockResolvedValueOnce([{ insertId: 202 }]);     // INSERT alert

    const res = await request(app)
      .post('/vendor-onboard/' + 'd'.repeat(64) + '/reject');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // No "UPDATE vendors" call — only the alert insert + the consume UPDATE
    const venUpd = db.query.mock.calls.find(c => /UPDATE vendors\b/.test(c[0]));
    expect(venUpd).toBeUndefined();
    const alertCall = db.query.mock.calls.find(c => /INSERT INTO vendor_alerts/.test(c[0]));
    expect(alertCall[1][1]).toBe('bank_change.vendor_rejected');
  });
});
