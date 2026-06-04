// modules/system/tests/contract.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const System = require('../contract');

describe('M7 System — contract surface', () => {
  test('semver version', () => {
    expect(System.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function keys stable', () => {
    ['getNavForRole', 'getSLAsForProject'].forEach(k => {
      expect(typeof System.functions[k]).toBe('function');
    });
  });

  test('all routes are Express routers', () => {
    const required = [
      'nav', 'navAdmin', 'projectSlas', 'notifications', 'whatsapp',
      'comms', 'governance', 'delegations', 'aiTriggers',
      'pmcAssignments', 'lookup',
    ];
    required.forEach(k => {
      const r = System.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owns system-level tables; does not claim other modules tables', () => {
    expect(System.tables).toEqual(expect.arrayContaining([
      'role_nav', 'project_slas', 'whatsapp_notifications', 'comms_log',
      'delegations',
    ]));
    expect(System.tables).not.toContain('users');
    expect(System.tables).not.toContain('projects');
    expect(System.tables).not.toContain('payment_requests');
    expect(System.tables).not.toContain('grns');
    expect(System.tables).not.toContain('pmc_deputy'); // dropped in v5.11
  });
});

describe('M7 System — getNavForRole', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('filters by role and is_visible=1', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await System.functions.getNavForRole('principal');
    expect(db.query.mock.calls[0][0]).toMatch(/role = \? AND is_visible = 1/);
    expect(db.query.mock.calls[0][1]).toEqual(['principal']);
  });

  test('returns empty array when no nav rows', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await System.functions.getNavForRole('trainee');
    expect(r).toEqual([]);
  });

  test('detailing_head navigation logic loads properly', async () => {
    const mockNavRows = [
      { role: 'detailing_head', bucket: 'home', tab_key: 'dashboard', sort_order: 1, is_visible: 1 }
    ];
    db.query.mockResolvedValueOnce([mockNavRows]);
    const r = await System.functions.getNavForRole('detailing_head');
    expect(r).toEqual(mockNavRows);
    expect(db.query.mock.calls[0][1]).toEqual(['detailing_head']);
  });
});

describe('M7 System — route mounts respond', () => {
  function makeAuthedApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'naveen', full_name: 'N', role, stream: 'all' };
      next();
    });
    app.use('/api/nav',              System.routes.nav);
    app.use('/api/nav-admin',        System.routes.navAdmin);
    app.use('/api/notifications',    System.routes.notifications);
    app.use('/api/comms',            System.routes.comms);
    app.use('/api/governance',       System.routes.governance);
    app.use('/api/delegations',      System.routes.delegations);
    app.use('/api/lookup',           System.routes.lookup);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test.each([
    ['/api/nav'],
    ['/api/notifications'],
    ['/api/lookup/roles'],
    ['/api/delegations'],
  ])('GET %s responds (<500)', async (url) => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get(url);
    expect(r.status).toBeLessThan(500);
  });
});
