// modules/auth/tests/contract.test.js
// ═══════════════════════════════════════════════════════════════════════════
// M1 Auth — contract-level tests.
// These lock the PUBLIC API other modules will depend on. Any breaking change
// here must bump contract.version and coordinate with consumers.
// ═══════════════════════════════════════════════════════════════════════════
const request = require('supertest');
const express = require('express');
const session = require('express-session');

// Mock db — all tests drive db.query behaviour deterministically
jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const Auth = require('../contract');

describe('M1 Auth — contract surface', () => {
  test('exposes semver version', () => {
    expect(Auth.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('middleware contract keys are stable', () => {
    // Locking this list prevents silent removal. If you add one, that's fine.
    // If you remove one, a consumer might break — bump major version.
    const required = [
      'requireAuth', 'requireRole', 'requirePrincipal', 'requirePMC',
      'requireDesign', 'requireServices', 'requireProjectScope',
      'requireScopeFromEntity', 'blockAuditWrites',
    ];
    required.forEach(k => {
      expect(typeof Auth.middleware[k]).toBe('function');
    });
  });

  test('function contract keys are stable', () => {
    expect(typeof Auth.functions.getUser).toBe('function');
    expect(typeof Auth.functions.getUsersByRole).toBe('function');
    expect(typeof Auth.functions.canApproveDrawing).toBe('function');
    expect(typeof Auth.functions.canFlagDrawing).toBe('function');
    expect(typeof Auth.functions.canApproveSchedule).toBe('function');
  });

  test('routes are mountable Express routers', () => {
    ['auth', 'users', 'userManagement', 'adminReset'].forEach(k => {
      const r = Auth.routes[k];
      expect(typeof r).toBe('function');
      // Express routers have a .stack array — crude but effective check
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('declares owned tables', () => {
    expect(Auth.tables).toEqual(expect.arrayContaining(['users', 'user_pending']));
    expect(Auth.tables).not.toContain('password_reset_otps'); // dropped in v5.12
  });
});

describe('M1 Auth — requireAuth middleware', () => {
  test('blocks unauthenticated requests', () => {
    const req = { session: {}, path: '/api/foo' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    Auth.middleware.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows authenticated requests', () => {
    const req = { session: { user: { id: 1, role: 'principal' } }, path: '/api/foo' };
    const res = {};
    const next = jest.fn();
    Auth.middleware.requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('M1 Auth — requireRole middleware', () => {
  test('blocks role not in allowed list', () => {
    const mw = Auth.middleware.requireRole('principal', 'pmc_head');
    const req = { session: { user: { id: 1, role: 'site_manager' } } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows role in allowed list', () => {
    const mw = Auth.middleware.requireRole('principal', 'pmc_head');
    const req = { session: { user: { id: 1, role: 'pmc_head' } } };
    const res = {};
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('M1 Auth — getUser function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns user row by id', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 5, username: 'test_principal', full_name: 'Test Principal', role: 'principal', stream: 'all', is_active: 1 },
    ]]);
    const u = await Auth.functions.getUser(5);
    expect(u.id).toBe(5);
    expect(u.role).toBe('principal');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM users WHERE id = ?'), [5]);
  });

  test('returns null when user not found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const u = await Auth.functions.getUser(999);
    expect(u).toBeNull();
  });
});

describe('M1 Auth — getUsersByRole function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns all users with given role when no project', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, username: 'naveen', full_name: 'Naveen', role: 'principal' },
      { id: 22, username: 'test_principal', full_name: 'Test Principal', role: 'principal' },
    ]]);
    const rows = await Auth.functions.getUsersByRole('principal');
    expect(rows).toHaveLength(2);
    expect(db.query.mock.calls[0][0]).not.toContain('project_assignments');
  });

  test('scopes by project when projectId given', async () => {
    db.query.mockResolvedValueOnce([[{ id: 22, username: 'test_principal', full_name: 'Test Principal', role: 'principal' }]]);
    const rows = await Auth.functions.getUsersByRole('principal', 1);
    expect(rows).toHaveLength(1);
    expect(db.query.mock.calls[0][0]).toContain('project_assignments');
    expect(db.query.mock.calls[0][1]).toEqual(['principal', 1]);
  });
});

describe('M1 Auth — login route (smoke test)', () => {
  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'test-secret-at-least-32-chars-long-ok', resave: false, saveUninitialized: false }));
    app.use('/api/auth', Auth.routes.auth);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing credentials with 400', async () => {
    const r = await request(makeApp()).post('/api/auth/login').send({});
    expect(r.status).toBe(400);
  });

  test('rejects unknown user with 401', async () => {
    db.query.mockResolvedValueOnce([[]]); // no user found
    const r = await request(makeApp()).post('/api/auth/login').send({ username: 'nobody', password: 'x' });
    expect(r.status).toBe(401);
  });

  test('rejects wrong password with 401', async () => {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('right-password', 10);
    db.query.mockResolvedValueOnce([[
      { id: 1, username: 'naveen', password_hash: hash, full_name: 'Naveen', role: 'principal', stream: 'all', is_active: 1, force_password_change: 0 },
    ]]);
    const r = await request(makeApp()).post('/api/auth/login').send({ username: 'naveen', password: 'wrong-password' });
    expect(r.status).toBe(401);
  });
});

describe('M1 Auth — getUsers (bulk)', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('empty array returns empty Map without hitting db', async () => {
    const m = await Auth.functions.getUsers([]);
    expect(m.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('non-array returns empty Map', async () => {
    const m = await Auth.functions.getUsers(null);
    expect(m.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns Map keyed by id', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, full_name: 'Naveen', phone: '9000000001' },
      { id: 2, full_name: 'Ajay',   phone: '9000000002' },
    ]]);
    const m = await Auth.functions.getUsers([1, 2]);
    expect(m.get(1).full_name).toBe('Naveen');
    expect(m.get(2).full_name).toBe('Ajay');
  });

  test('dedupes ids and skips falsy', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, full_name: 'Naveen' }]]);
    await Auth.functions.getUsers([1, null, 1, undefined, 0]);
    // IN (?) expects unique ids — verify by checking what was sent
    expect(db.query.mock.calls[0][1]).toEqual([[1]]);
  });
});

describe('M1 Auth — getPmcHeadsForProject', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('empty when projectId missing', async () => {
    const r = await Auth.functions.getPmcHeadsForProject();
    expect(r).toEqual([]);
  });

  test('filters by role + active + assignment', async () => {
    db.query.mockResolvedValueOnce([[{ id: 5, phone: '90...', full_name: 'PMC1' }]]);
    const rows = await Auth.functions.getPmcHeadsForProject(1);
    expect(rows.length).toBe(1);
    expect(db.query.mock.calls[0][0]).toMatch(/pmc_head/);
    expect(db.query.mock.calls[0][0]).toMatch(/is_active = 1/);
  });
});
