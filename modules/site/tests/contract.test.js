// modules/site/tests/contract.test.js
const request = require('supertest');
const express = require('express');
const session = require('express-session');

jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const Site = require('../contract');

describe('M4 Site — contract surface', () => {
  test('exposes semver version', () => {
    expect(Site.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('function keys are stable', () => {
    const required = ['getDailyReport', 'getOpenIssues', 'getOpenGRNs', 'getApprovedGRNs', 'getSiteTeam',
                      'countIssuesByFilter', 'listIssuesByFilter', 'listDrawingQueries', 'getIssueById'];
    required.forEach(k => expect(typeof Site.functions[k]).toBe('function'));
  });

  test('routes are Express routers', () => {
    const required = ['dailyReports', 'grn', 'issues', 'photos', 'photoTags', 'labour', 'forms'];
    required.forEach(k => {
      const r = Site.routes[k];
      expect(typeof r).toBe('function');
      expect(Array.isArray(r.stack)).toBe(true);
    });
  });

  test('owns expected tables', () => {
    expect(Site.tables).toEqual(expect.arrayContaining([
      'daily_reports', 'grns', 'issues', 'project_photos', 'photo_tags',
      'labour_register', 'form_templates', 'form_submissions',
    ]));
    // Does not claim tables owned by other modules
    expect(Site.tables).not.toContain('users');
    expect(Site.tables).not.toContain('projects');
    expect(Site.tables).not.toContain('payment_requests');
    expect(Site.tables).not.toContain('vendors');
  });
});

describe('M4 Site — getDailyReport function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns report by project + date', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, project_id: 1, report_date: '2026-04-21', status: 'approved', overall_notes: 'Foundation progress' },
    ]]);
    const r = await Site.functions.getDailyReport(1, '2026-04-21');
    expect(r.status).toBe('approved');
    expect(db.query.mock.calls[0][0]).toContain('FROM daily_reports');
    expect(db.query.mock.calls[0][1]).toEqual([1, '2026-04-21']);
  });

  test('returns null when no report for that date', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await Site.functions.getDailyReport(1, '2026-04-99');
    expect(r).toBeNull();
  });
});

describe('M4 Site — getOpenIssues function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('filters by status=open', async () => {
    db.query.mockResolvedValueOnce([[
      { id: 1, issue_number: 'ISS-001', status: 'open', issue_type: 'rfi' },
    ]]);
    const rows = await Site.functions.getOpenIssues(1);
    expect(rows).toHaveLength(1);
    expect(db.query.mock.calls[0][0]).toContain("status = 'open'");
  });
});

describe('M4 Site — getOpenGRNs / getApprovedGRNs', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('getOpenGRNs filters for not-yet-approved', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getOpenGRNs(1);
    expect(db.query.mock.calls[0][0]).toMatch(/status IS NULL OR g\.status != 'approved'/);
  });

  test('getApprovedGRNs filters for status=approved', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getApprovedGRNs(1);
    expect(db.query.mock.calls[0][0]).toMatch(/status = 'approved'/);
  });

  test('getApprovedGRNs joins vendor name (Finance handoff)', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getApprovedGRNs(1);
    expect(db.query.mock.calls[0][0]).toMatch(/JOIN vendors/);
  });
});

describe('M4 Site — getSiteTeam function', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('scopes to site_manager + senior_site_manager roles', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getSiteTeam(1);
    expect(db.query.mock.calls[0][0]).toMatch(/role IN \('site_manager', 'senior_site_manager'\)/);
  });
});

describe('M4 Site — getDailyReportsInRange', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('filters by project_id and date range', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getDailyReportsInRange(1, '2026-04-01', '2026-04-07');
    expect(db.query.mock.calls[0][0]).toMatch(/report_date BETWEEN \? AND \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, '2026-04-01', '2026-04-07']);
  });

  test('orders by report_date ascending for week rollup', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getDailyReportsInRange(1, '2026-04-01', '2026-04-07');
    expect(db.query.mock.calls[0][0]).toMatch(/ORDER BY report_date/);
  });
});

describe('M4 Site — recordSiteManagerLeave', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects when required params missing', async () => {
    await expect(
      Site.functions.recordSiteManagerLeave({ userId: 1, projectId: 2 })
    ).rejects.toThrow(/required/);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('inserts into site_manager_leave with correct columns', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 42 }]);
    const r = await Site.functions.recordSiteManagerLeave({
      userId: 5, projectId: 1,
      leaveFrom: '2026-05-01', leaveTo: '2026-05-07',
      reason: 'Family function', markedBy: 22,
    });
    expect(r).toEqual({ id: 42 });
    expect(db.query.mock.calls[0][0]).toMatch(/INSERT INTO site_manager_leave/);
    expect(db.query.mock.calls[0][1]).toEqual([5, 1, '2026-05-01', '2026-05-07', 'Family function', 22]);
  });

  test('nulls reason when not provided', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 43 }]);
    await Site.functions.recordSiteManagerLeave({
      userId: 5, projectId: 1,
      leaveFrom: '2026-05-01', leaveTo: '2026-05-07',
      markedBy: 22,
    });
    expect(db.query.mock.calls[0][1][4]).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route smoke tests
// ─────────────────────────────────────────────────────────────────────────────
describe('M4 Site — route mounts respond', () => {
  function makeAuthedApp(role = 'principal') {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'x'.repeat(40), resave: false, saveUninitialized: false }));
    app.use((req, res, next) => {
      req.session.user = { id: 1, username: 'test_principal', full_name: 'Test', role, stream: 'all' };
      next();
    });
    app.use('/api/daily-reports', Site.routes.dailyReports);
    app.use('/api/grn',           Site.routes.grn);
    app.use('/api/issues',        Site.routes.issues);
    app.use('/api/photos',        Site.routes.photos);
    app.use('/api/photo-tags',    Site.routes.photoTags);
    return app;
  }

  beforeEach(() => { db.query.mockReset(); });

  test('GET /api/daily-reports/1 responds (<500)', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/daily-reports/1');
    expect(r.status).toBeLessThan(500);
  });

  test('GET /api/grn/1 responds', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/grn/1');
    expect(r.status).toBeLessThan(500);
  });

  test('GET /api/issues/1 responds', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/issues/1');
    expect(r.status).toBeLessThan(500);
  });

  test('GET /api/photos/1 responds', async () => {
    db.query.mockResolvedValue([[]]);
    const r = await request(makeAuthedApp()).get('/api/photos/1');
    expect(r.status).toBeLessThan(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests for contract helpers added during Priority 4 (reports.js refactor)
// ─────────────────────────────────────────────────────────────────────────────

describe('M4 Site — acknowledgeDailyReportAnomaly', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing reportId', async () => {
    await expect(Site.functions.acknowledgeDailyReportAnomaly()).rejects.toThrow(/reportId/);
  });

  test('updates only unacknowledged flagged rows', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const r = await Site.functions.acknowledgeDailyReportAnomaly(42);
    expect(db.query.mock.calls[0][0]).toMatch(/UPDATE daily_reports/);
    expect(db.query.mock.calls[0][0]).toMatch(/ai_flag_acknowledged = 0/);
    expect(r.affected).toBe(1);
  });

  test('returns affected:0 when row already acknowledged', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const r = await Site.functions.acknowledgeDailyReportAnomaly(42);
    expect(r.affected).toBe(0);
  });
});

describe('M4 Site — approveAllPendingDailyReports', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing params', async () => {
    await expect(Site.functions.approveAllPendingDailyReports()).rejects.toThrow(/required/);
    await expect(Site.functions.approveAllPendingDailyReports(1)).rejects.toThrow(/required/);
  });

  test('SELECTs pending_review rows then transitions them via state machine', async () => {
    // First mock: SELECT returns 5 pending rows
    db.query.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]]);
    // Second mock: state machine bulk UPDATE returns 5 affected
    db.query.mockResolvedValueOnce([{ affectedRows: 5 }]);
    const r = await Site.functions.approveAllPendingDailyReports(1, 9);
    expect(db.query.mock.calls[0][0]).toMatch(/SELECT id FROM daily_reports/);
    expect(db.query.mock.calls[0][0]).toMatch(/status = 'pending_review'/);
    expect(db.query.mock.calls[0][1]).toEqual([1]);
    // Second call is the SM transitionMany — bulk UPDATE
    expect(db.query.mock.calls[1][0]).toMatch(/UPDATE daily_reports/);
    expect(db.query.mock.calls[1][0]).toMatch(/status = ?\?/);
    expect(r.approved).toBe(5);
  });

  test('returns approved:0 when no pending rows', async () => {
    db.query.mockResolvedValueOnce([[]]);
    const r = await Site.functions.approveAllPendingDailyReports(1, 9);
    expect(r.approved).toBe(0);
    // No second query when nothing to transition
    expect(db.query.mock.calls.length).toBe(1);
  });
});

describe('M4 Site — flagDailyReport', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing params', async () => {
    await expect(Site.functions.flagDailyReport({ reportId: 1 })).rejects.toThrow(/required/);
  });

  test('SELECTs current status, then transitions to flagged via state machine', async () => {
    // First mock: SELECT current status
    db.query.mockResolvedValueOnce([[{ status: 'pending_review' }]]);
    // Second mock: state machine UPDATE
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await Site.functions.flagDailyReport({ reportId: 42, flaggedBy: 9, reason: 'photos missing' });
    expect(db.query.mock.calls[0][0]).toMatch(/SELECT status FROM daily_reports/);
    expect(db.query.mock.calls[0][1]).toEqual([42]);
    // Second call is SM update
    expect(db.query.mock.calls[1][0]).toMatch(/UPDATE daily_reports/);
    // The args order is [...extraVals, id, fromStatus]; reason is in extraCols
    const args = db.query.mock.calls[1][1];
    expect(args).toContain('photos missing');
    expect(args).toContain(9);
    expect(args).toContain(42);
  });

  test('null reason allowed', async () => {
    db.query.mockResolvedValueOnce([[{ status: 'pending_review' }]]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await Site.functions.flagDailyReport({ reportId: 42, flaggedBy: 9 });
    // First arg in SM extraCols is flag_reason — verify it's null in the second call's args
    expect(db.query.mock.calls[1][1]).toContain(null);
  });
});

describe('M4 Site — getRecentPhotos', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing projectId or sinceDate', async () => {
    await expect(Site.functions.getRecentPhotos()).rejects.toThrow(/required/);
    await expect(Site.functions.getRecentPhotos(1)).rejects.toThrow(/required/);
  });

  test('filters by project_id + photo_date >= sinceDate with limit', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, file_path: 'p1.jpg', photo_date: '2026-04-20', caption: 'x' }]]);
    const r = await Site.functions.getRecentPhotos(1, '2026-04-18', 10);
    expect(r.length).toBe(1);
    // Post-v5.8: queries project_photos (with primary_entity_type filter), not the legacy project_photos table.
    expect(db.query.mock.calls[0][0]).toMatch(/project_photos/);
    expect(db.query.mock.calls[0][0]).toMatch(/primary_entity_type\s*=\s*'project_progress'/);
    expect(db.query.mock.calls[0][0]).toMatch(/LIMIT \?/);
    expect(db.query.mock.calls[0][1]).toEqual([1, '2026-04-18', 10]);
  });

  test('default limit is 20', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getRecentPhotos(1, '2026-01-01');
    expect(db.query.mock.calls[0][1][2]).toBe(20);
  });
});

describe('M4 Site — getOpenDesignIssuesWithDrawings', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('rejects missing projectId', async () => {
    await expect(Site.functions.getOpenDesignIssuesWithDrawings()).rejects.toThrow(/required/);
  });

  test('excludes closed; LEFT JOINs drawings (for issues without a drawing)', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.getOpenDesignIssuesWithDrawings(1);
    expect(db.query.mock.calls[0][0]).toMatch(/status != 'closed'/);
    expect(db.query.mock.calls[0][0]).toMatch(/LEFT JOIN drawing_versions/);
  });
});

describe('M4 Site — cluster 4 issue helpers (shape)', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('countIssuesByFilter returns 0 on empty project scope (no DB hit)', async () => {
    const n = await Site.functions.countIssuesByFilter([]);
    expect(n).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('countIssuesByFilter: no filters — counts all in scope', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 5 }]]);
    const n = await Site.functions.countIssuesByFilter([1, 2]);
    expect(n).toBe(5);
    expect(db.query.mock.calls[0][0]).toMatch(/project_id IN \(\?,\?\)/);
    expect(db.query.mock.calls[0][0]).not.toMatch(/issue_type IN/);
    expect(db.query.mock.calls[0][0]).not.toMatch(/status IN/);
  });

  test('countIssuesByFilter: with issueTypes + statuses composes AND clauses', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 3 }]]);
    await Site.functions.countIssuesByFilter(1, {
      issueTypes: ['rfi','design'], statuses: ['open']
    });
    expect(db.query.mock.calls[0][0]).toMatch(/issue_type IN \(\?,\?\)/);
    expect(db.query.mock.calls[0][0]).toMatch(/status IN \(\?\)/);
    expect(db.query.mock.calls[0][1]).toEqual([1, 'rfi', 'design', 'open']);
  });

  test('countIssuesByFilter accepts single projectId (not array)', async () => {
    db.query.mockResolvedValueOnce([[{ cnt: 2 }]]);
    await Site.functions.countIssuesByFilter(99);
    expect(db.query.mock.calls[0][1]).toContain(99);
  });

  test('listIssuesByFilter returns empty on empty projectIds', async () => {
    const r = await Site.functions.listIssuesByFilter({ projectIds: [] });
    expect(r).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('listIssuesByFilter: all filters + limit', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1 }]]);
    await Site.functions.listIssuesByFilter({
      projectIds: [1], issueTypes: ['rfi'], statuses: ['open'], minAgeDays: 3, limit: 10
    });
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/TIMESTAMPDIFF\(DAY, raised_at, NOW\(\)\) AS age_days/);
    expect(sql).toMatch(/TIMESTAMPDIFF\(DAY, raised_at, NOW\(\)\) >= \?/);
    expect(sql).toMatch(/ORDER BY raised_at ASC/);
    expect(sql).toMatch(/LIMIT \?/);
  });

  test('listDrawingQueries includes drawing_version_id IS NOT NULL filter', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.listDrawingQueries({ minAgeDays: 3 });
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/drawing_version_id IS NOT NULL/);
    expect(sql).toMatch(/DATEDIFF\(NOW\(\), raised_at\) >= \?/);
  });

  test('listDrawingQueries can bucket by maxAgeDays for fresh queries', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await Site.functions.listDrawingQueries({ maxAgeDays: 3 });
    expect(db.query.mock.calls[0][0]).toMatch(/DATEDIFF\(NOW\(\), raised_at\) < \?/);
  });

  test('getIssueById returns null for falsy id without DB hit', async () => {
    const r = await Site.functions.getIssueById(null);
    expect(r).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  test('getIssueById returns row or null', async () => {
    db.query.mockResolvedValueOnce([[{ id: 5, description: 'x' }]]);
    const r = await Site.functions.getIssueById(5);
    expect(r).toEqual({ id: 5, description: 'x' });
    db.query.mockResolvedValueOnce([[]]);
    const r2 = await Site.functions.getIssueById(999);
    expect(r2).toBeNull();
  });
});
