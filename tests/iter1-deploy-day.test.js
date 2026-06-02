// tests/iter1-deploy-day.test.js
// ════════════════════════════════════════════════════════════════════════════
// Tests for scripts/iter1-deploy-day.js — the pre-emptive vendor
// re-validation script. Verifies idempotency, dry-run safety, and the
// correct state changes.
// ════════════════════════════════════════════════════════════════════════════

jest.mock('../middleware/db', () => {
  const m = { query: jest.fn() };
  m.tx = jest.fn((fn) => fn({ query: m.query }));
  return m;
});

const db = require('../middleware/db');
const deploy = require('../scripts/iter1-deploy-day');

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
});

describe('iter1-deploy-day — snapshot', () => {
  test('reads counts from vendors table', async () => {
    db.query.mockResolvedValueOnce([[{
      total: 50, cleared: 30, pending: 18, rejected: 2,
      bank_validated: 5, bank_unvalidated: 45,
    }]]);
    const r = await deploy.snapshot();
    expect(r.total).toBe(50);
    expect(r.cleared).toBe(30);
    expect(r.bank_unvalidated).toBe(45);
    expect(db.query.mock.calls[0][0]).toMatch(/FROM vendors WHERE is_active = 1/);
  });
});

describe('iter1-deploy-day — applyChanges in dry-run', () => {
  test('reads candidates, returns counts, makes NO writes', async () => {
    db.query
      // 1. SELECT cleared candidates
      .mockResolvedValueOnce([[
        { id: 1, vendor_name: 'A', clearance_status: 'cleared', bank_validated_by_vendor: 0 },
        { id: 2, vendor_name: 'B', clearance_status: 'cleared', bank_validated_by_vendor: 1 },
      ]])
      // 2. SELECT bank-validated candidates
      .mockResolvedValueOnce([[
        { id: 2, vendor_name: 'B' },
      ]]);

    const r = await deploy.applyChanges(true);
    expect(r.clearanceReset).toBe(2);
    expect(r.bankReset).toBe(1);
    // No UPDATE or INSERT — only the two SELECTs
    expect(db.query.mock.calls.length).toBe(2);
    expect(db.query.mock.calls.every(c => /^\s*SELECT/i.test(c[0]))).toBe(true);
  });
});

describe('iter1-deploy-day — applyChanges live', () => {
  test('flips cleared vendors to pending and writes audit rows', async () => {
    db.query
      // SELECT cleared candidates
      .mockResolvedValueOnce([[
        { id: 1, vendor_name: 'A', clearance_status: 'cleared', bank_validated_by_vendor: 0 },
        { id: 2, vendor_name: 'B', clearance_status: 'cleared', bank_validated_by_vendor: 1 },
      ]])
      // SELECT bank-validated candidates
      .mockResolvedValueOnce([[{ id: 2, vendor_name: 'B' }]])
      // UPDATE vendors clearance_status
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      // INSERT audit_log clearance reset rows
      .mockResolvedValueOnce([{ affectedRows: 2 }])
      // UPDATE vendors bank_validated_by_vendor
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // INSERT audit_log bank reset row
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const r = await deploy.applyChanges(false);
    expect(r.clearanceReset).toBe(2);
    expect(r.bankReset).toBe(1);

    const calls = db.query.mock.calls;
    const upds = calls.filter(c => /^\s*UPDATE vendors/i.test(c[0]));
    expect(upds).toHaveLength(2);
    // First UPDATE flips clearance, second resets bank validation
    expect(upds[0][0]).toMatch(/clearance_status = 'pending'/);
    expect(upds[1][0]).toMatch(/bank_validated_by_vendor = 0/);
    // Audit logs inserted
    const audits = calls.filter(c => /INSERT INTO audit_log/i.test(c[0]));
    expect(audits).toHaveLength(2);
    // First audit batch has 2 rows (one per cleared vendor)
    // The flat params include 6 fields × N rows; first batch should be 2 rows = 12 params
    expect(audits[0][1].length).toBe(12);
  });

  test('idempotent: no work when nothing matches', async () => {
    db.query
      .mockResolvedValueOnce([[]])  // no cleared candidates
      .mockResolvedValueOnce([[]]); // no bank-validated candidates

    const r = await deploy.applyChanges(false);
    expect(r.clearanceReset).toBe(0);
    expect(r.bankReset).toBe(0);
    // Only the two SELECTs — no UPDATE, no INSERT
    expect(db.query.mock.calls.length).toBe(2);
  });

  test('only resets bank validation when there are validated rows', async () => {
    db.query
      .mockResolvedValueOnce([[]])     // no cleared candidates
      .mockResolvedValueOnce([[       // 1 bank-validated candidate
        { id: 5, vendor_name: 'C' },
      ]])
      // UPDATE vendors bank_validated
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // INSERT audit_log
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const r = await deploy.applyChanges(false);
    expect(r.clearanceReset).toBe(0);
    expect(r.bankReset).toBe(1);

    const upds = db.query.mock.calls.filter(c => /^\s*UPDATE vendors/i.test(c[0]));
    expect(upds).toHaveLength(1);
    expect(upds[0][0]).toMatch(/bank_validated_by_vendor = 0/);
  });
});
