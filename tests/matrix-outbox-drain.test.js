// tests/matrix-outbox-drain.test.js
// ============================================================
// Tests for scripts/matrix-outbox-drain.js — verifies the retry
// worker correctly drains the outbox, classifies errors, and
// preserves idempotency.
// ============================================================

const ORIG_ENV = { ...process.env };

jest.mock('../middleware/db', () => ({ query: jest.fn() }));
jest.mock('../services/http',  () => ({ put: jest.fn() }));
jest.mock('../services/matrix-adapter', () => ({ modeOf: jest.fn(() => 'LIVE') }));

const db     = require('../middleware/db');
const http   = require('../services/http');
const matrix = require('../services/matrix-adapter');

function freshWorker() {
  jest.resetModules();
  jest.doMock('../middleware/db',          () => db);
  jest.doMock('../services/http',          () => http);
  jest.doMock('../services/matrix-adapter', () => matrix);
  return require('../scripts/matrix-outbox-drain');
}

// run() begins with the "stuck in sending" recovery step (two UPDATEs) before
// it SELECTs the pending batch. Prime those two queries so the per-test mock
// chain lines up with the SELECT. Both return 0 affected rows (nothing stuck).
// NOTE: because of these two leading calls, db.query.mock.calls indices for the
// SELECT/claim/mark-* queries are offset by +2.
function primeRecovery() {
  db.query
    .mockResolvedValueOnce([{}])                   // stuck→pending recovery UPDATE (result unused)
    .mockResolvedValueOnce([{ affectedRows: 0 }]); // terminal-fail recovery UPDATE
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIG_ENV };
  process.env.MATRIX_HOMESERVER = 'https://test.ems.host';
  process.env.MATRIX_BOT_TOKEN  = 'syt_test';
  matrix.modeOf.mockReturnValue('LIVE');
});

afterAll(() => { process.env = ORIG_ENV; });

describe('matrix-outbox-drain — early exits', () => {
  test('skips entirely when matrix-adapter is not LIVE', async () => {
    matrix.modeOf.mockReturnValue('DRY_RUN');
    const w = freshWorker();
    const r = await w.run();
    expect(r).toEqual({ skipped: true, mode: 'DRY_RUN', drained: 0 });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('skips when MATRIX_DISABLED triggered (via modeOf=DISABLED)', async () => {
    matrix.modeOf.mockReturnValue('DISABLED');
    const w = freshWorker();
    const r = await w.run();
    expect(r.skipped).toBe(true);
    expect(http.put).not.toHaveBeenCalled();
  });

  test('returns drained=0 when outbox is empty', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query.mockResolvedValueOnce([[]]);  // SELECT pending — no rows
    const r = await w.run();
    expect(r).toMatchObject({ skipped: false, mode: 'LIVE', drained: 0 });
    // No "claim" UPDATE, no HTTP call
    expect(http.put).not.toHaveBeenCalled();
  });
});

describe('matrix-outbox-drain — successful sends', () => {
  test('drains a text row, marks sent, stamps event_id', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query
      // SELECT pending
      .mockResolvedValueOnce([[
        { id: 1, room_id: '!r:s', txn_id: 'tx1', msg_type: 'text', body: 'hi', mxc_url: null, attempts: 0 },
      ]])
      // claim UPDATE — affectedRows=1 means we got the row
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      // mark sent UPDATE
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    http.put.mockResolvedValueOnce({ data: { event_id: '$evt:s' } });

    const r = await w.run();
    expect(r).toMatchObject({ drained: 1, sent: 1, retried: 0, failed: 0 });
    // The mark-sent UPDATE should set status='sent' and matrix_event_id
    // (+2 offset for the two recovery UPDATEs at the head of run()).
    const markSentCall = db.query.mock.calls[4];
    expect(markSentCall[0]).toMatch(/SET status='sent'/);
    expect(markSentCall[1]).toEqual(expect.arrayContaining(['$evt:s', 1]));
  });

  test('drains a poll row, parses JSON body before re-sending', async () => {
    const w = freshWorker();
    const pollPayload = {
      'org.matrix.msc1767.text': 'Q?',
      'org.matrix.msc3381.poll.start': { question: { 'org.matrix.msc1767.text': 'Q?' }, answers: [] },
    };
    primeRecovery();
    db.query
      .mockResolvedValueOnce([[
        { id: 2, room_id: '!r:s', txn_id: 'tx2', msg_type: 'poll', body: JSON.stringify(pollPayload), mxc_url: null, attempts: 0 },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    http.put.mockResolvedValueOnce({ data: { event_id: '$pollevt:s' } });

    const r = await w.run();
    expect(r.sent).toBe(1);
    // PUT URL should hit poll.start endpoint
    expect(http.put.mock.calls[0][0]).toMatch(/poll\.start/);
    // Payload should be the parsed JSON, not a string
    expect(http.put.mock.calls[0][1]).toEqual(pollPayload);
  });
});

describe('matrix-outbox-drain — failures', () => {
  test('4xx response → terminal failed', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query
      .mockResolvedValueOnce([[
        { id: 3, room_id: '!r:s', txn_id: 'tx3', msg_type: 'text', body: 'hi', mxc_url: null, attempts: 0 },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // claim
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // mark failed
    http.put.mockRejectedValueOnce(Object.assign(new Error('M_FORBIDDEN'), {
      status: 403, response: { status: 403, data: { error: 'M_FORBIDDEN' } },
    }));

    const r = await w.run();
    expect(r.failed).toBe(1);
    expect(r.sent).toBe(0);
    const markFailedCall = db.query.mock.calls[4];
    expect(markFailedCall[0]).toMatch(/SET status='failed'/);
  });

  test('5xx response → marked pending, attempts incremented', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query
      .mockResolvedValueOnce([[
        { id: 4, room_id: '!r:s', txn_id: 'tx4', msg_type: 'text', body: 'hi', mxc_url: null, attempts: 0 },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])  // claim
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // re-pending
    http.put.mockRejectedValueOnce(Object.assign(new Error('upstream'), {
      status: 502, response: { status: 502 },
    }));

    const r = await w.run();
    expect(r.retried).toBe(1);
    expect(r.failed).toBe(0);
    const reupdateCall = db.query.mock.calls[4];
    expect(reupdateCall[0]).toMatch(/SET status='pending', attempts=\?/);
  });

  test('attempt count reaching MAX_ATTEMPTS on 5xx → terminal failed', async () => {
    const w = freshWorker();
    // attempts=7 means this is the 8th attempt (MAX_ATTEMPTS=8)
    primeRecovery();
    db.query
      .mockResolvedValueOnce([[
        { id: 5, room_id: '!r:s', txn_id: 'tx5', msg_type: 'text', body: 'hi', mxc_url: null, attempts: 7 },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    http.put.mockRejectedValueOnce(Object.assign(new Error('upstream'), {
      status: 502, response: { status: 502 },
    }));

    const r = await w.run();
    // Even though it's 5xx (transient), we've exhausted attempts
    expect(r.failed).toBe(1);
    const markFailedCall = db.query.mock.calls[4];
    expect(markFailedCall[0]).toMatch(/SET status='failed'/);
  });

  test('SELECT excludes rows with attempts >= MAX_ATTEMPTS', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query.mockResolvedValueOnce([[]]);  // empty
    await w.run();
    const selectCall = db.query.mock.calls[2];
    expect(selectCall[0]).toMatch(/attempts < \?/);
    expect(selectCall[1][0]).toBe(8);  // MAX_ATTEMPTS
  });
});

describe('matrix-outbox-drain — concurrent worker safety', () => {
  test('skips a row whose claim UPDATE got 0 affectedRows (stolen by parallel worker)', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query
      .mockResolvedValueOnce([[
        { id: 6, room_id: '!r:s', txn_id: 'tx6', msg_type: 'text', body: 'hi', mxc_url: null, attempts: 0 },
      ]])
      // claim UPDATE — affectedRows=0 means another worker grabbed it first
      .mockResolvedValueOnce([{ affectedRows: 0 }]);

    const r = await w.run();
    expect(r.drained).toBe(1);  // we picked it up in SELECT
    expect(r.sent).toBe(0);     // but didn't actually send
    expect(http.put).not.toHaveBeenCalled();
  });
});

describe('matrix-outbox-drain — replay uses txn_id verbatim', () => {
  test('PUT URL contains the original txn_id (idempotency)', async () => {
    const w = freshWorker();
    primeRecovery();
    db.query
      .mockResolvedValueOnce([[
        { id: 7, room_id: '!r:s', txn_id: 'original-txn-id', msg_type: 'text', body: 'hi', mxc_url: null, attempts: 1 },
      ]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    http.put.mockResolvedValueOnce({ data: { event_id: '$same-evt' } });

    await w.run();
    const url = http.put.mock.calls[0][0];
    // txn_id must be preserved exactly so Matrix idempotency works —
    // re-sending with same txn_id returns the same event_id rather than
    // creating a duplicate.
    expect(url).toContain(encodeURIComponent('original-txn-id'));
  });
});
