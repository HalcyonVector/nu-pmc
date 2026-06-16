// modules/reporting/tests/contract.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const Reporting = require('../contract');

describe('M6 Reporting — contract surface', () => {
  test('semver version', () => {
    expect(Reporting.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function keys stable', () => {
    ['getNeedsYouCount', 'getWeeklyHealthSummary'].forEach(k => {
      expect(typeof Reporting.functions[k]).toBe('function');
    });
  });

  test('all routes are Express routers', () => {
    const required = [
      'reports', 'weeklyHealth', 'weeklySignoff', 'dashboard',
      'accSummary', 'needsYou', 'pending', 'gantt',
    ];
    required.forEach(k => {
      const r = Reporting.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owns minimal tables; does not claim other modules tables', () => {
    expect(Reporting.tables).toEqual(expect.arrayContaining([
      'weekly_reports', 'weekly_report_documents',
    ]));
    // Must not claim ownership of other modules' tables
    expect(Reporting.tables).not.toContain('users');
    expect(Reporting.tables).not.toContain('projects');
    expect(Reporting.tables).not.toContain('payment_requests');
    expect(Reporting.tables).not.toContain('daily_reports');
    expect(Reporting.tables).not.toContain('grns');
  });
});

describe('M6 Reporting — getWeeklyHealthSummary', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns null when no report for week', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await Reporting.functions.getWeeklyHealthSummary(1, '2026-04-20');
    expect(r).toBeNull();
  });

  test('returns the latest submission for the week', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 3, project_id: 1, week_start: '2026-04-20', overall_status: 'amber' },
    ]]);
    const r = await Reporting.functions.getWeeklyHealthSummary(1, '2026-04-20');
    expect(r.overall_status).toBe('amber');
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY approved_at DESC LIMIT 1/);
  });
});

describe('M6 Reporting — route mounts respond', () => {
  function makeAuthedApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'principal', full_name: 'N', role, stream: 'all' };
      next();
    });
    app.use('/api/dashboard',      Reporting.routes.dashboard);
    app.use('/api/acc-summary',    Reporting.routes.accSummary);
    app.use('/api/needs-you',      Reporting.routes.needsYou);
    app.use('/api/pending',        Reporting.routes.pending);
    app.use('/api/gantt',          Reporting.routes.gantt);
    app.use('/api/reports',        Reporting.routes.reports);
    app.use('/api/weekly-health',  Reporting.routes.weeklyHealth);
    app.use('/api/weekly-signoff', Reporting.routes.weeklySignoff);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test.each([
    ['/api/dashboard'],
    ['/api/needs-you'],
    ['/api/pending'],
    ['/api/acc-summary/1'],
    ['/api/gantt/1'],
  ])('GET %s responds (<500)', async (url) => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get(url);
    expect(r.status).toBeLessThan(500);
  });
});
