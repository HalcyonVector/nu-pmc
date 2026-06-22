// modules/onboarding/tests/contract.test.js
// ═══════════════════════════════════════════════════════════════════════════
// M2 Onboarding — contract-level tests.
// Locks the public API and smoke-tests every route mount.
// Database is mocked so tests run without a live DB.
// ═══════════════════════════════════════════════════════════════════════════
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const Onboarding = require('../contract');

describe('M2 Onboarding — contract surface', () => {
  test('exposes semver version', () => {
    expect(Onboarding.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function contract keys are stable', () => {
    const required = [
      'getProject', 'getClient', 'getClientBOQ',
      'getClearedVendors', 'getProjectTeam',
      'getVendorsByIds', 'getEngagementsByIds',
      'getProjectsByIds', 'setChecklistFlag',
      'listEngagementsByProject',
    ];
    required.forEach(k => {
      expect(typeof Onboarding.functions[k]).toBe('function');
    });
  });

  test('routes are mountable Express routers', () => {
    const required = ['projects', 'clients', 'projectSetup', 'clientBOQ', 'vendors', 'documents'];
    required.forEach(k => {
      const r = Onboarding.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owned tables list is declared', () => {
    expect(Onboarding.tables).toEqual(
      expect.arrayContaining([
        'projects', 'project_assignments', 'clients',
        'vendors', 'client_boq_items',
        'project_documents', 'project_document_versions',
      ])
    );
    // Should not claim M1 Auth's tables
    expect(Onboarding.tables).not.toContain('users');
    expect(Onboarding.tables).not.toContain('password_reset_otps');
  });
});

describe('M2 Onboarding — getProject function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns project row by id', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, code: 'PV90', name: 'PV 90 Production Line', client: 'TLD MAINI GSE Pvt Ltd',
        status: 'active', location: 'Nelamangala, Bengaluru' },
    ]]);
    const p = await Onboarding.functions.getProject(1);
    expect(p.id).toBe(1);
    expect(p.code).toBe('PV90');
    expect(db.query.mock.calls[0][0]).toContain('FROM projects WHERE id = ?');
    expect(db.query.mock.calls[0][1]).toEqual([1]);
  });

  test('returns null when project not found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const p = await Onboarding.functions.getProject(999);
    expect(p).toBeNull();
  });
});

describe('M2 Onboarding — getClient function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('joins projects→clients and returns the client', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 5, client_name: 'TLD MAINI GSE Pvt Ltd', address: 'Nelamangala' },
    ]]);
    const c = await Onboarding.functions.getClient(1);
    expect(c.client_name).toContain('TLD MAINI');
    // Confirm the join actually happens
    expect(db.query.mock.calls[0][0]).toContain('JOIN projects');
  });
});

describe('M2 Onboarding — getClearedVendors function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('filters for PAN+GSTIN validated vendors', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, trade: 'Civil', vendor_name: 'BlueStone Constructions', pan_validated: 1, gstin_validated: 1 },
    ]]);
    const rows = await Onboarding.functions.getClearedVendors();
    expect(rows).toHaveLength(1);
    expect(db.query.mock.calls[0][0]).toContain('pan_validated = 1');
    expect(db.query.mock.calls[0][0]).toContain('gstin_validated = 1');
  });

  test('scopes by trade when given', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Onboarding.functions.getClearedVendors('Electrical');
    expect(db.query.mock.calls[0][0]).toContain('trade = ?');
    expect(db.query.mock.calls[0][1]).toEqual(['Electrical']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route smoke tests — each mount responds
// ─────────────────────────────────────────────────────────────────────────────
describe('M2 Onboarding — getVendorEngagement + getApprovedEngagements + getActiveProjects', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('getVendorEngagement returns null when not found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await Onboarding.functions.getVendorEngagement(999);
    expect(r).toBeNull();
  });

  test('getVendorEngagement joins vendors and returns combined record', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, vendor_id: 3, vendor_name: 'BlueStone Constructions', trade: 'Civil', approval_status: 'approved' },
    ]]);
    const r = await Onboarding.functions.getVendorEngagement(1);
    expect(r.vendor_name).toBe('BlueStone Constructions');
    expect(db.query.mock.calls[0][0]).toMatch(/JOIN vendors/);
  });

  test('getApprovedEngagements filters by approval_status', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Onboarding.functions.getApprovedEngagements(1);
    expect(db.query.mock.calls[0][0]).toMatch(/approval_status = 'approved'/);
  });

  test('getActiveProjects filters status=active (includes initialising)', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Onboarding.functions.getActiveProjects();
    expect(db.query.mock.calls[0][0]).toMatch(/status IN \('active', 'initialising'\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('M2 Onboarding — getVendorsByIds + getEngagementsByIds (bulk helpers)', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('getVendorsByIds returns empty Map on empty/null input without querying', async () => {
    const r1 = await Onboarding.functions.getVendorsByIds([]);
    const r2 = await Onboarding.functions.getVendorsByIds(null);
    const r3 = await Onboarding.functions.getVendorsByIds(undefined);
    expect(r1).toBeInstanceOf(Map);
    expect(r1.size).toBe(0);
    expect(r2.size).toBe(0);
    expect(r3.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('getVendorsByIds de-duplicates and filters nulls, returns Map keyed by id', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 3, vendor_name: 'Alpha Civil', trade: 'civil' },
      { id: 5, vendor_name: 'Beta Electrical', trade: 'electrical' },
    ]]);
    const result = await Onboarding.functions.getVendorsByIds([3, 5, 3, null, undefined, 5]);
    expect(result.get(3).vendor_name).toBe('Alpha Civil');
    expect(result.get(5).vendor_name).toBe('Beta Electrical');
    // Should have fired with 2 unique ids, not 6
    expect(db.query.mock.calls[0][1]).toEqual([3, 5]);
    expect(db.query.mock.calls[0][0]).toMatch(/FROM vendors WHERE id IN \(\?,\?\)/);
  });

  test('getEngagementsByIds joins vendors and returns Map', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 100, vendor_id: 3, project_id: 1, contract_value: 50000,
        vendor_name: 'Alpha Civil', trade: 'civil', clearance_status: 'cleared' },
    ]]);
    const result = await Onboarding.functions.getEngagementsByIds([100]);
    expect(result.get(100).vendor_name).toBe('Alpha Civil');
    expect(result.get(100).trade).toBe('civil');
    expect(db.query.mock.calls[0][0]).toMatch(/JOIN vendors v ON ve\.vendor_id = v\.id/);
  });

  test('getEngagementsByIds returns empty Map on empty input', async () => {
    const r = await Onboarding.functions.getEngagementsByIds([]);
    expect(r).toBeInstanceOf(Map);
    expect(r.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getProjectsByIds + setChecklistFlag — added in Pass 2 cross-module rewrite
// ─────────────────────────────────────────────────────────────────────────────
describe('M2 Onboarding — getProjectsByIds (bulk helper)', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns empty Map on empty/null input without querying', async () => {
    const r1 = await Onboarding.functions.getProjectsByIds([]);
    const r2 = await Onboarding.functions.getProjectsByIds(null);
    expect(r1).toBeInstanceOf(Map);
    expect(r1.size).toBe(0);
    expect(r2.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('de-duplicates and filters nulls, returns Map keyed by id', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, code: 'WSB', name: 'WeSchool Bengaluru', client: 'SPM', location: 'Bengaluru' },
      { id: 2, code: 'DAIT', name: 'Dr AIT New Building', client: 'Dr AIT', location: 'Bengaluru' },
    ]]);
    const result = await Onboarding.functions.getProjectsByIds([1, 2, 1, null, 2]);
    expect(result.get(1).code).toBe('WSB');
    expect(result.get(2).code).toBe('DAIT');
    expect(db.query.mock.calls[0][1]).toEqual([1, 2]);
    expect(db.query.mock.calls[0][0]).toMatch(/FROM projects WHERE id IN \(\?,\?\)/);
  });
});

describe('M2 Onboarding — setChecklistFlag (whitelist-guarded writer)', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('accepts whitelisted flag and returns true when row updated', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const ok = await Onboarding.functions.setChecklistFlag(5, 'checklist_design_boq');
    expect(ok).toBe(true);
    expect(db.query.mock.calls[0][0]).toMatch(/UPDATE projects SET checklist_design_boq = 1 WHERE id = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  test('returns false when project_id does not exist', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const ok = await Onboarding.functions.setChecklistFlag(99999, 'checklist_schedule');
    expect(ok).toBe(false);
  });

  test('throws TypeError on non-whitelisted flag name, does NOT query', async () => {
    await expect(
      Onboarding.functions.setChecklistFlag(5, 'checklist_fake_flag')
    ).rejects.toThrow(TypeError);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('throws TypeError on attempted SQL injection via flag name', async () => {
    await expect(
      Onboarding.functions.setChecklistFlag(5, 'checklist_design_boq = 1; DROP TABLE projects; --')
    ).rejects.toThrow(TypeError);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('uses supplied conn object instead of module pool when passed', async () => {
    const conn = { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) };
    const ok = await Onboarding.functions.setChecklistFlag(5, 'checklist_schedule', conn);
    expect(ok).toBe(true);
    expect(conn.query).toHaveBeenCalled();
    // Module-level db.query must NOT have been used
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('M2 Onboarding — listEngagementsByProject', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns engagements with vendor fields joined inline', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 10, vendor_id: 3, project_id: 1, scope: 'Civil', vendor_name: 'Alpha Civil', trade: 'civil', is_active: 1 },
      { id: 11, vendor_id: 4, project_id: 1, scope: 'Electrical', vendor_name: 'Beta Elec', trade: 'electrical', is_active: 1 },
    ]]);
    const rows = await Onboarding.functions.listEngagementsByProject(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].vendor_name).toBe('Alpha Civil');
    expect(db.query.mock.calls[0][0]).toMatch(/AND ve\.is_active = 1/);
  });

  test('defaults to active-only, can include inactive with opts', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Onboarding.functions.listEngagementsByProject(1, { activeOnly: false });
    expect(db.query.mock.calls[0][0]).not.toMatch(/AND ve\.is_active = 1/);
  });
});

describe('M2 Onboarding — route mounts respond', () => {
  function makeAuthedApp(roleOverride = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    // Inject a logged-in user into every request
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'test_principal', full_name: 'Test', role: roleOverride, stream: 'all' };
      next();
    });
    app.use('/api/projects',      Onboarding.routes.projects);
    app.use('/api/clients',       Onboarding.routes.clients);
    app.use('/api/vendors',       Onboarding.routes.vendors);
    app.use('/api/client-boq',    Onboarding.routes.clientBOQ);
    app.use('/api/project-setup', Onboarding.routes.projectSetup);
    app.use('/api/documents',     Onboarding.routes.documents);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('GET /api/projects responds (2xx or 4xx, not 5xx)', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/projects');
    expect(r.status).toBeLessThan(500);
  });

  test('GET /api/vendors responds', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/vendors');
    expect(r.status).toBeLessThan(500);
  });

  test('GET /api/clients responds', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/clients');
    expect(r.status).toBeLessThan(500);
  });

  test('GET /api/documents/1 responds', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/documents/1');
    expect(r.status).toBeLessThan(500);
  });
});

describe('Onboarding — isUserAssignedToProject', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('false when userId or projectId missing', async () => {
    expect(await Onboarding.functions.isUserAssignedToProject(null, 1)).toBe(false);
    expect(await Onboarding.functions.isUserAssignedToProject(1, null)).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('true when active assignment exists', async () => {
    db.query.mockResolvedValueOnce([[{ id: 99 }]]);
    const r = await Onboarding.functions.isUserAssignedToProject(1, 2);
    expect(r).toBe(true);
    expect(db.query.mock.calls[0][0]).toMatch(/is_active = 1/);
  });

  test('false when no row found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await Onboarding.functions.isUserAssignedToProject(1, 2);
    expect(r).toBe(false);
  });
});
