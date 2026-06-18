// tests/vendor-onboarding.test.js
// ============================================================
// Tests for services/vendor-onboarding.js
// Covers token issue, lookup, open (preview detection), consume, expire.
// ============================================================

jest.mock('../middleware/db', () => {
  const m = { query: jest.fn() };
  m.tx = jest.fn((fn) => fn({ query: m.query }));
  return m;
});

const db = require('../middleware/db');
const onboarding = require('../services/vendor-onboarding');

beforeEach(() => {
  jest.clearAllMocks();
  db.query.mockReset();
  db.query.mockResolvedValue([[]]);
});

describe('isPreviewCrawler', () => {
  test('treats WhatsApp UA as crawler', () => {
    const req = { headers: { 'user-agent': 'WhatsApp/2.21', accept: 'text/html' } };
    expect(onboarding.isPreviewCrawler(req)).toBe(true);
  });
  test('treats facebookexternalhit as crawler', () => {
    const req = { headers: { 'user-agent': 'facebookexternalhit/1.1', accept: 'text/html' } };
    expect(onboarding.isPreviewCrawler(req)).toBe(true);
  });
  test('treats empty UA as crawler', () => {
    const req = { headers: { accept: 'text/html' } };
    expect(onboarding.isPreviewCrawler(req)).toBe(true);
  });
  test('treats missing Accept as crawler', () => {
    const req = { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 13)' } };
    expect(onboarding.isPreviewCrawler(req)).toBe(true);
  });
  test('treats real Chrome as not-crawler', () => {
    const req = {
      headers: {
        'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
      },
    };
    expect(onboarding.isPreviewCrawler(req)).toBe(false);
  });
});

describe('issue', () => {
  test('rejects invalid purpose', async () => {
    await expect(onboarding.issue({
      vendorId: 1, purpose: 'nonsense', issuedBy: 5,
    })).rejects.toMatchObject({ code: 'PURPOSE_INVALID' });
  });
  test('rejects missing vendorId', async () => {
    await expect(onboarding.issue({
      purpose: 'bank_confirm', issuedBy: 5,
    })).rejects.toMatchObject({ code: 'VENDOR_REQUIRED' });
  });
  test('issues a token, revokes prior actives, returns 64-char hex', async () => {
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])     // revoke prior actives
      .mockResolvedValueOnce([{ insertId: 42 }]);        // INSERT
    const r = await onboarding.issue({
      vendorId: 5, purpose: 'bank_confirm', issuedBy: 9,
      payload: { test: 1 }, approvalId: 100,
    });
    expect(r.token).toMatch(/^[a-f0-9]{64}$/);
    expect(r.id).toBe(42);
    expect(r.expiresAt).toBeInstanceOf(Date);
    // expiresAt should be ~48h from now
    const diffMs = r.expiresAt - new Date();
    expect(diffMs).toBeGreaterThan(47 * 3600 * 1000);
    expect(diffMs).toBeLessThan(49 * 3600 * 1000);
    // Revoke fired
    expect(db.query.mock.calls[0][0]).toMatch(/UPDATE vendor_onboarding_tokens/);
    expect(db.query.mock.calls[0][0]).toMatch(/SET status = 'revoked'/);
  });
});

describe('lookup', () => {
  test('rejects malformed token', async () => {
    await expect(onboarding.lookup('not-hex')).rejects.toMatchObject({
      code: 'TOKEN_FORMAT', status: 404,
    });
  });
  test('rejects unknown token', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await expect(onboarding.lookup('a'.repeat(64))).rejects.toMatchObject({
      code: 'TOKEN_NOT_FOUND',
    });
  });
  test('flags expired token via expires_at < now', async () => {
    const past = new Date(Date.now() - 1000);
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'issued', expires_at: past,
      vendor_name: 'A', vendor_phone: '91', bank_name: 'B',
      bank_account: '1', bank_ifsc: 'I', gst_number: null, pan_number: null,
      clearance_status: 'pending', bank_validated_by_vendor: 0,
    }]]);
    const r = await onboarding.lookup('a'.repeat(64));
    expect(r.isExpired).toBe(true);
  });
  test('reports consumed status', async () => {
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'consumed',
      expires_at: new Date(Date.now() + 3600_000),
      vendor_name: 'A', vendor_phone: '91',
      bank_name: 'B', bank_account: '1', bank_ifsc: 'I',
      gst_number: null, pan_number: null,
      clearance_status: 'pending', bank_validated_by_vendor: 0,
    }]]);
    const r = await onboarding.lookup('b'.repeat(64));
    expect(r.isConsumed).toBe(true);
  });
});

describe('recordOpen', () => {
  test('crawler hit: bumps open_count but does not change status', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, status: 'issued', open_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);   // bump open_count
    const req = { headers: { 'user-agent': 'WhatsApp/2.21', accept: 'text/html' } };
    const r = await onboarding.recordOpen('a'.repeat(64), req);
    expect(r.wasCrawler).toBe(true);
    expect(r.opened).toBe(false);
    // No "status='opened'" UPDATE fired — only the open_count bump
    const updates = db.query.mock.calls.filter(c => /UPDATE vendor_onboarding_tokens/i.test(c[0]));
    expect(updates).toHaveLength(1);
    expect(updates[0][0]).toMatch(/open_count = open_count \+ 1/);
  });
  test('real browser hit: marks opened on first non-crawler hit', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, status: 'issued', open_count: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])    // bump open_count
      .mockResolvedValueOnce([{ affectedRows: 1 }]);   // status='opened'
    const req = { headers: {
      'user-agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/120',
      accept: 'text/html,application/xhtml+xml',
    }};
    const r = await onboarding.recordOpen('a'.repeat(64), req);
    expect(r.wasCrawler).toBe(false);
    expect(r.opened).toBe(true);
    const updates = db.query.mock.calls.filter(c => /UPDATE vendor_onboarding_tokens/i.test(c[0]));
    expect(updates).toHaveLength(2);
    expect(updates[1][0]).toMatch(/SET status = 'opened'/);
  });
  test('returns opened:false when token was already opened by an earlier real hit', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, status: 'opened', open_count: 5 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // bump
    const req = { headers: {
      'user-agent': 'Mozilla/5.0 Chrome/120',
      accept: 'text/html',
    }};
    const r = await onboarding.recordOpen('a'.repeat(64), req);
    expect(r.opened).toBe(false);
  });
  // B9: both UPDATEs must run inside a single tx so a partial failure
  // doesn't inflate open_count without flipping status. The mock at the
  // top of this file routes `db.tx(fn)` to `fn({ query: db.query })`, so
  // confirming both UPDATEs ran via db.query mock confirms tx was used.
  test('B9 — both UPDATEs run inside the same tx', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 1, status: 'issued', open_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = { headers: {
      'user-agent': 'Mozilla/5.0 Chrome/120',
      accept: 'text/html',
    }};
    await onboarding.recordOpen('a'.repeat(64), req);
    const updates = db.query.mock.calls.filter(c => /UPDATE vendor_onboarding_tokens/i.test(c[0]));
    expect(updates).toHaveLength(2);
    // Source-level guard — recordOpen() body uses db.tx(...).
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(path.join(__dirname, '..', 'services/vendor-onboarding.js'), 'utf8');
    const fn   = src.match(/async function recordOpen\([\s\S]+?\n\}/)[0];
    expect(fn).toMatch(/db\.tx\(/);
  });
});

describe('consume', () => {
  function lookupMock(overrides = {}) {
    db.query.mockResolvedValueOnce([[{
      id: 1, vendor_id: 5, status: 'opened', purpose: 'bank_confirm',
      expires_at: new Date(Date.now() + 3600_000),
      payload_json: JSON.stringify({ k: 'v' }),
      approval_id: 100,
      vendor_name: 'A', vendor_phone: '91',
      bank_name: 'B', bank_account: '1', bank_ifsc: 'I',
      gst_number: null, pan_number: null,
      clearance_status: 'pending', bank_validated_by_vendor: 0,
      ...overrides,
    }]]);
  }

  test('happy path: marks consumed, returns payload + vendor info', async () => {
    lookupMock();
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);  // consume UPDATE
    const r = await onboarding.consume('a'.repeat(64));
    expect(r.tokenId).toBe(1);
    expect(r.vendorId).toBe(5);
    expect(r.purpose).toBe('bank_confirm');
    expect(r.payload).toEqual({ k: 'v' });
    expect(r.approvalId).toBe(100);
  });
  test('rejects expired token', async () => {
    lookupMock({ expires_at: new Date(Date.now() - 1000) });
    await expect(onboarding.consume('a'.repeat(64))).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED', status: 410,
    });
  });
  test('rejects already-consumed token', async () => {
    lookupMock({ status: 'consumed' });
    await expect(onboarding.consume('a'.repeat(64))).rejects.toMatchObject({
      code: 'TOKEN_CONSUMED', status: 409,
    });
  });
  test('rejects revoked token', async () => {
    lookupMock({ status: 'revoked' });
    await expect(onboarding.consume('a'.repeat(64))).rejects.toMatchObject({
      code: 'TOKEN_REVOKED', status: 410,
    });
  });
  test('rejects when consume UPDATE affects 0 rows (race)', async () => {
    lookupMock();
    db.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await expect(onboarding.consume('a'.repeat(64))).rejects.toMatchObject({
      code: 'TOKEN_RACE', status: 409,
    });
  });
});

describe('expireOldTokens', () => {
  test('returns count of expired rows', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 7 }]);
    const r = await onboarding.expireOldTokens();
    expect(r.expired).toBe(7);
    expect(db.query.mock.calls[0][0]).toMatch(/SET status = 'expired'/);
  });
});
