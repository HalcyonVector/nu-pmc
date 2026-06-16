// modules/design-services/tests/contract.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const DS = require('../contract');

describe('design-services — contract surface', () => {
  test('semver version', () => {
    expect(DS.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function keys stable', () => {
    ['getCurrentBOQ', 'getScheduleTasks', 'getDrawings', 'getDrawingRegister',
     'getDrawingContextByVersionIds', 'countDrawingVersions', 'countDrawingVersionsMulti',
     'getCurrentScheduleVersion', 'hasCurrentScheduleVersion', 'promoteScheduleVersion'].forEach(k => {
      expect(typeof DS.functions[k]).toBe('function');
    });
  });

  test('all routes are Express routers', () => {
    ['drawings', 'register', 'schedule', 'materials'].forEach(k => {
      const r = DS.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owns drawing/schedule/BOQ tables; not others', () => {
    expect(DS.tables).toEqual(expect.arrayContaining([
      'drawings', 'drawing_versions', 'drawing_register',
      'schedule_versions', 'schedule_tasks',
      'boq_versions', 'boq_items', 'material_requests',
    ]));
    expect(DS.tables).not.toContain('users');
    expect(DS.tables).not.toContain('projects');
    expect(DS.tables).not.toContain('payment_requests');
    expect(DS.tables).not.toContain('grns');
    expect(DS.tables).not.toContain('daily_reports');
  });
});

describe('design-services — getCurrentBOQ', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('filters by is_current = 1', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await DS.functions.getCurrentBOQ(1);
    expect(db.query.mock.calls[0][0]).toMatch(/is_current = 1/);
  });

  test('filters by stream when given', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await DS.functions.getCurrentBOQ(1, 'design');
    expect(db.query.mock.calls[0][0]).toMatch(/bv\.stream = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 'design']);
  });

  test('joins boq_items and boq_versions', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await DS.functions.getCurrentBOQ(1);
    expect(db.query.mock.calls[0][0]).toMatch(/JOIN boq_versions/);
  });
});

describe('design-services — getScheduleTasks', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('uses current schedule version only', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await DS.functions.getScheduleTasks(1);
    expect(db.query.mock.calls[0][0]).toMatch(/sv\.is_current = 1/);
  });
});

describe('design-services — getDrawings / getDrawingRegister', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('getDrawings scopes by stream when given', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await DS.functions.getDrawings(1, 'services');
    expect(db.query.mock.calls[0][0]).toMatch(/stream = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 'services']);
  });

  test('getDrawingRegister returns both streams when stream omitted', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await DS.functions.getDrawingRegister(1);
    expect(db.query.mock.calls[0][0]).not.toMatch(/stream = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1]);
  });
});

describe('design-services — route mounts respond', () => {
  function makeAuthedApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'principal', full_name: 'N', role, stream: 'all' };
      next();
    });
    app.use('/api/drawings',  DS.routes.drawings);
    app.use('/api/register',  DS.routes.register);
    app.use('/api/schedule',  DS.routes.schedule);
    app.use('/api/materials', DS.routes.materials);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test.each([
    ['/api/drawings/1'],
    ['/api/register/1'],
    ['/api/schedule/1'],
    ['/api/materials/1'],
  ])('GET %s responds (<500)', async (url) => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get(url);
    expect(r.status).toBeLessThan(500);
  });
});

describe('design-services — report-aggregation getters', () => {
  beforeEach(() => { db.query.mockReset(); });

  describe('getCurrentScheduleSummary', () => {
    test('rejects missing projectId', async () => {
      await expect(DS.functions.getCurrentScheduleSummary()).rejects.toThrow(/required/);
    });

    test('aggregates using current schedule version', async () => {
      db.query.mockResolvedValueOnce([[{
        total_tasks: 10, completed: 4, in_progress: 5, on_hold: 1,
        avg_pct_complete: 42.5, last_update_date: '2026-04-20',
      }]]);
      const r = await DS.functions.getCurrentScheduleSummary(1);
      expect(r.total_tasks).toBe(10);
      expect(db.query.mock.calls[0][0]).toMatch(/sv.is_current = 1/);
    });

    test('returns default shape when no rows', async () => {
      db.query.mockResolvedValueOnce([[]]);
      const r = await DS.functions.getCurrentScheduleSummary(1);
      expect(r.total_tasks).toBe(0);
    });
  });

  describe('getRecentTaskUpdates', () => {
    test('rejects missing params', async () => {
      await expect(DS.functions.getRecentTaskUpdates(1)).rejects.toThrow(/required/);
    });
    test('filters by project and sinceDate', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getRecentTaskUpdates(1, '2026-04-18');
      expect(db.query.mock.calls[0][1]).toEqual([1, '2026-04-18']);
    });
  });

  describe('getOverdueMaterialRequests', () => {
    test('filters by is_overdue=1', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getOverdueMaterialRequests(1);
      expect(db.query.mock.calls[0][0]).toMatch(/is_overdue = 1/);
    });
  });

  describe('getTaskProgressByTradeMonth', () => {
    test('returns null when no updates in range', async () => {
      db.query.mockResolvedValueOnce([[{ avg_pct: null }]]);
      const r = await DS.functions.getTaskProgressByTradeMonth(1, 'civil', '2026-04-01', '2026-04-30');
      expect(r).toBeNull();
    });

    test('returns numeric average', async () => {
      db.query.mockResolvedValueOnce([[{ avg_pct: '67.33' }]]);
      const r = await DS.functions.getTaskProgressByTradeMonth(1, 'civil', '2026-04-01', '2026-04-30');
      expect(r).toBeCloseTo(67.33);
    });
  });

  describe('getScheduleProgressByTrade + ByTradeSince + flagged + materials + tasks-with-latest', () => {
    test('getScheduleProgressByTrade filters current version', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getScheduleProgressByTrade(1);
      expect(db.query.mock.calls[0][0]).toMatch(/is_current = 1/);
    });

    test('getScheduleProgressByTradeSince includes flag count', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getScheduleProgressByTradeSince(1, '2026-04-18');
      expect(db.query.mock.calls[0][0]).toMatch(/SUM\(tu.is_flagged\)/);
    });

    test('getFlaggedTaskUpdates filters is_flagged=1', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getFlaggedTaskUpdates(1);
      expect(db.query.mock.calls[0][0]).toMatch(/is_flagged = 1/);
    });

    test('getMaterialRequestsWithBOQ joins boq_items', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getMaterialRequestsWithBOQ(1);
      expect(db.query.mock.calls[0][0]).toMatch(/JOIN boq_items/);
    });

    test('getTasksWithLatestUpdate uses correlated subquery', async () => {
      db.query.mockResolvedValueOnce([[]]);
      await DS.functions.getTasksWithLatestUpdate(1);
      expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY tu.report_date DESC LIMIT 1/);
    });
  });
});

describe('design-services — drawing bulk helpers', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('getDrawingContextByVersionIds returns empty Map on empty input', async () => {
    const r = await DS.functions.getDrawingContextByVersionIds([]);
    expect(r).toBeInstanceOf(Map);
    expect(r.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('getDrawingContextByVersionIds dedupes + returns Map keyed by version_id', async () => {
    db.query.mockResolvedValueOnce([[
      { version_id: 10, drawing_id: 1, drawing_number: 'A-001', drawing_name: 'Plan', stream: 'design' },
      { version_id: 20, drawing_id: 2, drawing_number: 'S-012', drawing_name: 'Section', stream: 'services' },
    ]]);
    const r = await DS.functions.getDrawingContextByVersionIds([10, 20, 10, null]);
    expect(r.get(10).drawing_number).toBe('A-001');
    expect(r.get(20).stream).toBe('services');
    expect(db.query.mock.calls[0][1]).toEqual([10, 20]);
  });

  test('countDrawingVersions returns 0 on empty statuses', async () => {
    const n = await DS.functions.countDrawingVersions(1, []);
    expect(n).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('countDrawingVersions builds status IN clause and stream filter', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 7 }]]);
    const n = await DS.functions.countDrawingVersions(1, ['pending_l1','pending_l2'], 'design');
    expect(n).toBe(7);
    expect(db.query.mock.calls[0][0]).toMatch(/dv\.status IN \(\?,\?\)/);
    expect(db.query.mock.calls[0][0]).toMatch(/AND d\.stream = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 'pending_l1', 'pending_l2', 'design']);
  });

  test('countDrawingVersionsMulti handles multi-project scope', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 12 }]]);
    const n = await DS.functions.countDrawingVersionsMulti([1, 2, 3], ['pending_l1']);
    expect(n).toBe(12);
    expect(db.query.mock.calls[0][0]).toMatch(/d\.project_id IN \(\?,\?,\?\)/);
  });

  test('countDrawingVersionsMulti returns 0 on empty projectIds array', async () => {
    const n = await DS.functions.countDrawingVersionsMulti([], ['pending_l1']);
    expect(n).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('countDrawingVersionsMulti with null projectIds = no scope filter (firm-wide)', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 40 }]]);
    const n = await DS.functions.countDrawingVersionsMulti(null, ['pending_l1']);
    expect(n).toBe(40);
    expect(db.query.mock.calls[0][0]).not.toMatch(/project_id IN/);
  });
});
