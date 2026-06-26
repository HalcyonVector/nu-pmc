// modules/readiness-gate/tests/contract.test.js
jest.mock('../../../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
}));
const db = require('../../../middleware/db');

const Gate = require('../contract');

// Helper: build a fake project row with all checklist flags set to 1,
// then flip off whichever ones are named.
function projectRowMissing(...missing) {
  const row = {
    id: 1, status: 'initialising',
    checklist_project_created: 1,
    checklist_design_register: 1,
    checklist_services_register: 1,
    checklist_design_boq: 1,
    checklist_services_boq: 1,
    checklist_schedule: 1,
    checklist_site_manager: 1,
  };
  for (const key of missing) {
    const blocker = Gate.constants.BLOCKERS.find(b => b.key === key);
    if (!blocker) throw new Error(`Unknown blocker key in test: ${key}`);
    row[blocker.column] = 0;
  }
  return row;
}

describe('M3 Readiness Gate — contract surface', () => {
  test('exposes semver version', () => {
    expect(Gate.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('exposes three functions', () => {
    expect(typeof Gate.functions.checkReadiness).toBe('function');
    expect(typeof Gate.functions.assertReady).toBe('function');
    expect(typeof Gate.functions.activateIfReady).toBe('function');
  });

  test('declares 7 blockers with expected keys', () => {
    const keys = Gate.constants.BLOCKERS.map(b => b.key).sort();
    expect(keys).toEqual([
      'design_boq', 'design_register', 'project_created',
      'schedule', 'services_boq', 'services_register', 'site_manager',
    ]);
  });

  test('owns no tables (pure-logic module)', () => {
    expect(Gate.tables).toEqual([]);
  });
});

describe('M3 Readiness Gate — checkReadiness', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('returns ready: true when all 7 flags are 1', async () => {
    db.query.mockResolvedValueOnce([[projectRowMissing()]]);
    const r = await Gate.functions.checkReadiness(1);
    expect(r.ready).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.completed).toHaveLength(7);
  });

  test('returns ready: false when ANY flag is 0', async () => {
    db.query.mockResolvedValueOnce([[projectRowMissing('site_manager')]]);
    const r = await Gate.functions.checkReadiness(1);
    expect(r.ready).toBe(false);
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0].key).toBe('site_manager');
    expect(r.blockers[0].label).toContain('Site manager');
    expect(r.completed).toHaveLength(6);
  });

  test('reports every missing blocker, not just the first', async () => {
    db.query.mockResolvedValueOnce([[
      projectRowMissing('design_boq', 'services_boq', 'schedule'),
    ]]);
    const r = await Gate.functions.checkReadiness(1);
    expect(r.ready).toBe(false);
    expect(r.blockers.map(b => b.key).sort()).toEqual(
      ['design_boq', 'schedule', 'services_boq']
    );
    expect(r.completed).toHaveLength(4);
  });

  test('throws when project does not exist', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await expect(Gate.functions.checkReadiness(999)).rejects.toThrow(/not found/);
  });

  // One test per blocker: confirm the check catches it in isolation
  Gate.constants.BLOCKERS.forEach(blocker => {
    test(`catches '${blocker.key}' when only that flag is 0`, async () => {
      db.query.mockResolvedValueOnce([[projectRowMissing(blocker.key)]]);
      const r = await Gate.functions.checkReadiness(1);
      expect(r.ready).toBe(false);
      expect(r.blockers).toHaveLength(1);
      expect(r.blockers[0].key).toBe(blocker.key);
    });
  });
});

describe('M3 Readiness Gate — assertReady', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('resolves when ready', async () => {
    db.query.mockResolvedValueOnce([[projectRowMissing()]]);
    await expect(Gate.functions.assertReady(1)).resolves.toMatchObject({ ready: true });
  });

  test('throws 409 with blockers when not ready', async () => {
    db.query.mockResolvedValueOnce([[projectRowMissing('schedule', 'site_manager')]]);
    try {
      await Gate.functions.assertReady(1);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.statusCode).toBe(409);
      expect(e.blockers).toHaveLength(2);
      expect(e.message).toMatch(/not ready/i);
    }
  });
});

describe('M3 Readiness Gate — activateIfReady', () => {
  beforeEach(() => { db.query.mockReset(); });

  test('flips status to active when ready and still initialising', async () => {
    db.query.mockResolvedValueOnce([[projectRowMissing()]]); // SELECT
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);   // SM UPDATE (concurrency-guarded)
    const r = await Gate.functions.activateIfReady(1);
    expect(r.ready).toBe(true);
    expect(r.status).toBe('active');
    expect(r.justActivated).toBe(true);
    // Assert the UPDATE was issued — now via state machine (param-binding,
    // concurrency-guarded by `WHERE id = ? AND status = ?`)
    expect(db.query).toHaveBeenCalledTimes(2);
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE projects SET status = \?/);
    // Params: [to_status, id, from_status]
    expect(updateCall[1]).toEqual(expect.arrayContaining(['active', 1, 'initialising']));
  });

  test('does NOT update when not ready', async () => {
    db.query.mockResolvedValueOnce([[projectRowMissing('site_manager')]]);
    const r = await Gate.functions.activateIfReady(1);
    expect(r.ready).toBe(false);
    expect(r.justActivated).toBe(false);
    // Only the SELECT was issued, no UPDATE
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('is idempotent — does not re-activate an already active project', async () => {
    const row = projectRowMissing();
    row.status = 'active';
    db.query.mockResolvedValueOnce([[row]]);
    const r = await Gate.functions.activateIfReady(1);
    expect(r.ready).toBe(true);
    expect(r.status).toBe('active');
    expect(r.justActivated).toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1); // no UPDATE issued
  });
});
