// modules/workflow/tests/contract.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const W = require('../contract');

describe('workflow — contract surface', () => {
  test('semver version', () => {
    expect(W.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function keys stable', () => {
    ['getMeeting', 'getRecentMeetings', 'getOpenChangeNotices', 'getSubmittals', 'getMeasurements']
      .forEach(k => expect(typeof W.functions[k]).toBe('function'));
  });

  test('all routes are Express routers', () => {
    ['meetings', 'changes', 'approvals', 'measurements', 'submittals'].forEach(k => {
      const r = W.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owns workflow tables; does not claim others', () => {
    expect(W.tables).toEqual(expect.arrayContaining([
      'meetings', 'meeting_actions', 'change_notices', 'measurements', 'submittals',
    ]));
    expect(W.tables).not.toContain('users');
    expect(W.tables).not.toContain('projects');
    expect(W.tables).not.toContain('payment_requests');
    expect(W.tables).not.toContain('grns');
    expect(W.tables).not.toContain('drawings');
  });
});

describe('workflow — getMeeting', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns null when meeting not found', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await W.functions.getMeeting(999);
    expect(r).toBeNull();
  });

  test('filters by project_id when given', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, project_id: 5, title: 'Kickoff' }]]);
    await W.functions.getMeeting(1, 5);
    expect(db.query.mock.calls[0][0]).toMatch(/AND project_id = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 5]);
  });
});

describe('workflow — getRecentMeetings', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('defaults to 20 limit', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getRecentMeetings(1);
    expect(db.query.mock.calls[0][1]).toEqual([1, 20]);
  });

  test('respects custom limit', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getRecentMeetings(1, 5);
    expect(db.query.mock.calls[0][1]).toEqual([1, 5]);
  });

  test('orders by meeting_date desc', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getRecentMeetings(1);
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY meeting_date DESC/);
  });
});

describe('workflow — getOpenChangeNotices', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('excludes signed_off/rejected/withdrawn', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getOpenChangeNotices(1);
    expect(db.query.mock.calls[0][0]).toMatch(/NOT IN \('signed_off', 'rejected', 'withdrawn'\)/);
  });
});

describe('workflow — route mounts respond', () => {
  function makeAuthedApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'principal', full_name: 'N', role, stream: 'all' };
      next();
    });
    app.use('/api/meetings',      W.routes.meetings);
    app.use('/api/changes',       W.routes.changes);
    app.use('/api/approvals',     W.routes.approvals);
    app.use('/api/measurements',  W.routes.measurements);
    app.use('/api/submittals',    W.routes.submittals);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test.each([
    ['/api/meetings/1'],
    ['/api/changes/1'],
    ['/api/measurements/1'],
    ['/api/submittals/1'],
  ])('GET %s responds (<500)', async (url) => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get(url);
    expect(r.status).toBeLessThan(500);
  });
});

describe('workflow — upsertMomItem', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing projectId or actorId', async () => {
    await expect(W.functions.upsertMomItem({ actorId: 9 })).rejects.toThrow(/required/);
    await expect(W.functions.upsertMomItem({ projectId: 1 })).rejects.toThrow(/required/);
  });

  test('closed status requires resolutionNote', async () => {
    await expect(W.functions.upsertMomItem({
      projectId: 1, actorId: 9, status: 'closed',
    })).rejects.toThrow(/resolutionNote/);
  });

  test('UPDATE path when id provided', async () => {
    db.query.mockResolvedValueOnce([[{ status: 'open' }]]);     // read current state
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);       // metadata UPDATE (same status)
    const r = await W.functions.upsertMomItem({
      id: 42, projectId: 1, actorId: 9,
      description: 'ignored on update',
      responsible: 'Design Principal', remarks: 'note', trade: 'civil', status: 'open',
    });
    // First call is the state-read SELECT, second is the metadata UPDATE
    expect(db.query.mock.calls[0][0]).toMatch(/SELECT status FROM mom_items/);
    expect(db.query.mock.calls[1][0]).toMatch(/UPDATE mom_items/);
    expect(r.id).toBe(42);
  });

  test('INSERT path when no id', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 100 }]);
    const r = await W.functions.upsertMomItem({
      projectId: 1, actorId: 9,
      description: 'New item',
      responsible: 'Design Principal', trade: 'MEP', status: 'open',
    });
    expect(db.query.mock.calls[0][0]).toMatch(/INSERT INTO mom_items/);
    expect(r.id).toBe(100);
  });

  test('INSERT requires description', async () => {
    await expect(W.functions.upsertMomItem({
      projectId: 1, actorId: 9, responsible: 'x', status: 'open',
    })).rejects.toThrow(/description/);
  });
});

describe('workflow — getLatestOpenMomItems', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing projectId', async () => {
    await expect(W.functions.getLatestOpenMomItems()).rejects.toThrow(/required/);
  });

  test('excludes closed items, respects limit default=50', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getLatestOpenMomItems(1);
    expect(db.query.mock.calls[0][0]).toMatch(/status != 'closed'/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 50]);
  });

  test('explicit limit honoured', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getLatestOpenMomItems(1, 500);
    expect(db.query.mock.calls[0][1]).toEqual([1, 500]);
  });
});

describe('workflow — getMostRecentSiteVisit', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing projectId', async () => {
    await expect(W.functions.getMostRecentSiteVisit()).rejects.toThrow(/required/);
  });

  test('returns null when no site visits', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await W.functions.getMostRecentSiteVisit(1);
    expect(r).toBeNull();
  });

  test('returns most recent when found', async () => {
    db.query.mockResolvedValueOnce([[{ id: 5, drafted_by: 9, meeting_date: '2026-04-22', observations: 'a|b' }]]);
    const r = await W.functions.getMostRecentSiteVisit(1);
    expect(r.id).toBe(5);
  });
});

describe('workflow — getSiteVisitObservationsBetween', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing params', async () => {
    await expect(W.functions.getSiteVisitObservationsBetween()).rejects.toThrow(/required/);
    await expect(W.functions.getSiteVisitObservationsBetween(1)).rejects.toThrow(/required/);
    await expect(W.functions.getSiteVisitObservationsBetween(1, '2026-04-18')).rejects.toThrow(/required/);
  });

  test('filters by project + type=site_visit + date range', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.getSiteVisitObservationsBetween(1, '2026-04-18', '2026-04-25');
    expect(db.query.mock.calls[0][0]).toMatch(/type = 'site_visit'/);
    expect(db.query.mock.calls[0][1]).toEqual([1, '2026-04-18', '2026-04-25']);
  });
});

describe('workflow — listMomItems', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing projectId', async () => {
    await expect(W.functions.listMomItems()).rejects.toThrow(/required/);
  });

  test('optional status filter appended', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.listMomItems(1, { status: 'open' });
    expect(db.query.mock.calls[0][0]).toMatch(/AND status = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 'open', 200]);
  });

  test('no status → no status clause', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await W.functions.listMomItems(1);
    expect(db.query.mock.calls[0][0]).not.toMatch(/AND status = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 200]);
  });
});
