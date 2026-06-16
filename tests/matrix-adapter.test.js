// tests/matrix-adapter.test.js
// ============================================================
// Tests for services/matrix-adapter.js — verifies dry-run/live/disabled
// modes, idempotency, outbox semantics, and HTTP error mapping.
// ============================================================

// Reset env between tests so modeOf() picks up changes
const ORIG_ENV = { ...process.env };

jest.mock('../middleware/db', () => ({
  query: jest.fn(),
  getConnection: jest.fn(),
  tx: jest.fn((fn) => fn({ query: jest.requireMock('../middleware/db').query })),
}));

jest.mock('../services/http', () => ({
  get:  jest.fn(),
  post: jest.fn(),
  put:  jest.fn(),
}));

const db   = require('../middleware/db');
const http = require('../services/http');

function freshAdapter() {
  // Drop jest's internal module cache so MATRIX_BOT_TOKEN env changes are
  // picked up by module-load-time constants.
  jest.resetModules();
  // Re-establish mocks after reset (resetModules clears them too).
  jest.doMock('../middleware/db', () => ({
    query: db.query,
    getConnection: db.getConnection,
    tx: db.tx,
  }));
  jest.doMock('../services/http', () => ({
    get: http.get, post: http.post, put: http.put,
  }));
  return require('../services/matrix-adapter');
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIG_ENV };
  delete process.env.MATRIX_BOT_TOKEN;
  delete process.env.MATRIX_HOMESERVER;
  delete process.env.MATRIX_DISABLED;
});

afterAll(() => {
  process.env = ORIG_ENV;
});

describe('matrix-adapter — modeOf()', () => {
  test('DRY_RUN when no token configured', () => {
    const adapter = freshAdapter();
    expect(adapter.modeOf()).toBe('DRY_RUN');
  });

  test('LIVE when token + homeserver configured', () => {
    process.env.MATRIX_BOT_TOKEN  = 'syt_test';
    process.env.MATRIX_HOMESERVER = 'https://test.ems.host';
    const adapter = freshAdapter();
    expect(adapter.modeOf()).toBe('LIVE');
  });

  test('DRY_RUN when token set but homeserver missing (graceful)', () => {
    process.env.MATRIX_BOT_TOKEN = 'syt_test';
    const adapter = freshAdapter();
    expect(adapter.modeOf()).toBe('DRY_RUN');
  });

  test('DISABLED when MATRIX_DISABLED=1', () => {
    process.env.MATRIX_DISABLED = '1';
    process.env.MATRIX_BOT_TOKEN = 'syt_test';
    process.env.MATRIX_HOMESERVER = 'https://test.ems.host';
    const adapter = freshAdapter();
    expect(adapter.modeOf()).toBe('DISABLED');
  });
});

describe('matrix-adapter — sendText() in DRY_RUN', () => {
  test('writes to outbox with status=dry_run, returns outboxId, no HTTP call', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([{ insertId: 42 }]);   // INSERT outbox

    const r = await adapter.sendText({
      roomId: '!abc:test', body: 'hello', recipientUid: 7,
    });

    expect(r.mode).toBe('DRY_RUN');
    expect(r.outboxId).toBe(42);
    expect(r.eventId).toBeNull();
    // No HTTP call
    expect(http.put).not.toHaveBeenCalled();
    // Outbox INSERT had status=dry_run
    const insertCall = db.query.mock.calls[0];
    expect(insertCall[0]).toMatch(/INSERT INTO matrix_outbox/);
    // params: [roomId, txnId, msgType, body, mxcUrl, recipientUid, status]
    expect(insertCall[1]).toEqual(expect.arrayContaining(['!abc:test', 'text', 'hello', null, 7, 'dry_run']));
  });

  test('throws on missing roomId', async () => {
    const adapter = freshAdapter();
    await expect(adapter.sendText({ body: 'hi' })).rejects.toThrow(/roomId required/);
  });

  test('throws on missing body', async () => {
    const adapter = freshAdapter();
    await expect(adapter.sendText({ roomId: '!a:b' })).rejects.toThrow(/body required/);
  });
});

describe('matrix-adapter — sendText() in LIVE mode', () => {
  beforeEach(() => {
    process.env.MATRIX_BOT_TOKEN  = 'syt_test';
    process.env.MATRIX_HOMESERVER = 'https://test.ems.host';
  });

  test('PUT to correct URL with auth header, marks outbox sent on success', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([{ insertId: 100 }]);  // INSERT outbox
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE outbox sent
    http.put.mockResolvedValueOnce({ data: { event_id: '$evt_1:test' } });

    const r = await adapter.sendText({ roomId: '!room:test', body: 'hi' });

    expect(r.mode).toBe('LIVE');
    expect(r.eventId).toBe('$evt_1:test');
    expect(http.put).toHaveBeenCalledTimes(1);
    const [url, payload, opts] = http.put.mock.calls[0];
    expect(url).toMatch(/_matrix\/client\/v3\/rooms\/[^/]+\/send\/m\.room\.message\/[^/]+$/);
    expect(payload).toEqual({ msgtype: 'm.text', body: 'hi' });
    expect(opts.headers.Authorization).toBe('Bearer syt_test');
  });

  test('marks outbox failed on 4xx error', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([{ insertId: 100 }]);  // INSERT outbox
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE failed
    const httpErr = Object.assign(new Error('forbidden'), {
      response: { status: 403, data: { error: 'M_FORBIDDEN: not in room' } },
    });
    http.put.mockRejectedValueOnce(httpErr);

    await expect(adapter.sendText({ roomId: '!r:t', body: 'hi' })).rejects.toMatchObject({
      code: 'MATRIX_4XX', status: 403,
    });
    const updateCall = db.query.mock.calls.find(c => /SET status='failed'/.test(c[0]));
    expect(updateCall).toBeDefined();
  });

  test('marks outbox retry-pending on 5xx / network error', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([{ insertId: 100 }]);
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE pending+attempts++
    const httpErr = Object.assign(new Error('upstream timeout'), {
      response: { status: 504, data: { error: 'gateway timeout' } },
    });
    http.put.mockRejectedValueOnce(httpErr);

    await expect(adapter.sendText({ roomId: '!r:t', body: 'hi' })).rejects.toMatchObject({
      code: 'MATRIX_RETRY', status: 503,
    });
    const updateCall = db.query.mock.calls.find(c => /SET status='pending'/.test(c[0]));
    expect(updateCall).toBeDefined();
  });
});

describe('matrix-adapter — sendPoll()', () => {
  test('rejects polls with fewer than 2 answers', async () => {
    const adapter = freshAdapter();
    await expect(adapter.sendPoll({
      roomId: '!r:t', question: 'Approve?', answers: [{ id: 'yes', text: '✅ Yes' }],
    })).rejects.toThrow(/At least 2 answers/);
  });

  test('DRY_RUN encodes payload to outbox.body as JSON', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([{ insertId: 50 }]);
    await adapter.sendPoll({
      roomId: '!r:t', question: 'Approve?',
      answers: [{ id: 'yes', text: '✅ Yes' }, { id: 'no', text: '❌ No' }],
    });
    const insertCall = db.query.mock.calls[0];
    expect(insertCall[1][2]).toBe('poll');           // msg_type column position
    const body = insertCall[1][3];                    // body column position
    const parsed = JSON.parse(body);
    expect(parsed['org.matrix.msc3381.poll.start'].answers).toHaveLength(2);
  });
});

describe('matrix-adapter — getProjectRoomId / getInternalRoomId', () => {
  test('looks up by project_id + room_type', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([[{ room_id: '!site:test' }]]);
    const r = await adapter.getProjectRoomId(5, 'site');
    expect(r).toBe('!site:test');
    expect(db.query.mock.calls[0][0]).toMatch(/project_id = \?/);
    expect(db.query.mock.calls[0][1]).toEqual([5, 'site']);
  });

  test('returns null when no row matches', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([[]]);
    const r = await adapter.getProjectRoomId(5, 'site');
    expect(r).toBeNull();
  });

  test('internal room: project_id IS NULL', async () => {
    const adapter = freshAdapter();
    db.query.mockResolvedValueOnce([[{ room_id: '!principal:test' }]]);
    const r = await adapter.getInternalRoomId('internal_principal');
    expect(r).toBe('!principal:test');
    expect(db.query.mock.calls[0][0]).toMatch(/project_id IS NULL/);
  });
});

describe('matrix-adapter — makeTxnId', () => {
  test('generates unique ids on rapid successive calls', () => {
    const adapter = freshAdapter();
    const a = adapter.makeTxnId();
    const b = adapter.makeTxnId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^\d+\.[a-z0-9]+$/);
  });
});
