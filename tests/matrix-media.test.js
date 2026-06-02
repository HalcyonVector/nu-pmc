// tests/matrix-media.test.js
// ============================================================
// Tests for services/matrix-media.js (delta brief §11).
//
// Covers:
//   - skipped paths: not-a-file, malformed, room-not-known
//   - duplicate detection by matrix_event_id (early)
//   - thread-root → document_id / workflow_type resolution
//   - uploader Matrix ID → users.id resolution
//   - video size-cap rejection (25 MB)
//   - image compression branch via sharp (>2 MB)
//   - filesystem persistence under UPLOAD_DIR/matrix-media/<project_code>
//   - DB INSERT into document_attachments
//   - race-condition handling (ER_DUP_ENTRY → 'duplicate')
//   - _safeFilename helper sanitisation
// ============================================================

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

// Per-suite tmp dir so tests can verify file writes without touching
// the real uploads directory. Set BEFORE requiring matrix-media so the
// module's UPLOAD_DIR constant captures the value.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'nupmc-media-'));
process.env.UPLOAD_DIR = TMP_ROOT;

jest.mock('../middleware/db', () => ({
  query: jest.fn(),
}));

jest.mock('../services/matrix-adapter', () => ({
  downloadMedia: jest.fn(),
}));

// sharp is mocked so tests don't depend on a real JPEG roundtrip. The
// "compresses on image > 2MB" test verifies sharp() is invoked; the
// "stores raw on small images" test verifies sharp() is NOT invoked.
// Variable name must start with `mock` per jest's hoisting rule.
const mockSharp = jest.fn();
jest.mock('sharp', () => mockSharp);

const db            = require('../middleware/db');
const matrixAdapter = require('../services/matrix-adapter');
const matrixMedia   = require('../services/matrix-media');

beforeEach(() => {
  db.query.mockReset();
  matrixAdapter.downloadMedia.mockReset();
  mockSharp.mockReset();
});

afterAll(() => {
  // Best-effort cleanup of the per-suite tmp dir.
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
});

// Build a minimal m.image event the way Matrix delivers it.
function makeImageEvent({
  eventId    = '$evt:server',
  sender     = '@anjaneya:nuassociates.in',
  body       = 'photo.jpg',
  url        = 'mxc://nuassociates.ems.host/abc123',
  mimetype   = 'image/jpeg',
  size       = 50_000,
  ts         = 1746123456789,
  threadRoot = null,
  msgtype    = 'm.image',
} = {}) {
  const content = {
    msgtype, body, url,
    info: { mimetype, size },
  };
  if (threadRoot) content['m.relates_to'] = { rel_type: 'm.thread', event_id: threadRoot };
  return { event_id: eventId, sender, type: 'm.room.message', origin_server_ts: ts, content };
}

// ── _safeFilename ──────────────────────────────────────────────────

describe('_safeFilename', () => {
  test('keeps clean filenames intact', () => {
    expect(matrixMedia._safeFilename('photo-2026-05-02.jpg')).toBe('photo-2026-05-02.jpg');
  });

  test('replaces unsafe chars with underscore', () => {
    expect(matrixMedia._safeFilename('site photo (final).jpg')).toBe('site_photo_final_.jpg');
  });

  test('falls back to "file" on empty input', () => {
    expect(matrixMedia._safeFilename('')).toBe('file');
  });

  test('truncates very long names', () => {
    const long = 'a'.repeat(500) + '.jpg';
    const out  = matrixMedia._safeFilename(long);
    expect(out.length).toBeLessThanOrEqual(200);
  });
});

// ── skipped paths ──────────────────────────────────────────────────

describe('processIncomingFile — skipped paths', () => {
  test('skips non-file msgtypes (m.text)', async () => {
    const ev = { event_id: '$1', content: { msgtype: 'm.text', body: 'hi' } };
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out).toEqual({ action: 'skipped', reason: 'not_a_file' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('skips malformed events (no event_id)', async () => {
    const ev = { content: { msgtype: 'm.image', url: 'mxc://x/y' } };
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out.action).toBe('skipped');
    expect(out.reason).toBe('malformed_event');
  });

  test('skips malformed events (no content.url)', async () => {
    const ev = { event_id: '$1', content: { msgtype: 'm.image' } };
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out.action).toBe('skipped');
    expect(out.reason).toBe('malformed_event');
  });

  test('skips when room is not a known project room', async () => {
    db.query
      .mockResolvedValueOnce([[]])   // dedup check: not a duplicate
      .mockResolvedValueOnce([[]]);  // project_matrix_rooms lookup: empty

    const out = await matrixMedia.processIncomingFile(makeImageEvent(), '!ghost:s');
    expect(out).toEqual({ action: 'skipped', reason: 'room_not_a_project_room' });
    expect(matrixAdapter.downloadMedia).not.toHaveBeenCalled();
  });
});

// ── duplicate detection ────────────────────────────────────────────

describe('processIncomingFile — duplicate detection', () => {
  test('returns duplicate when matrix_event_id already recorded', async () => {
    db.query.mockResolvedValueOnce([[{ id: 99 }]]);   // dedup hit

    const out = await matrixMedia.processIncomingFile(makeImageEvent(), '!room:s');
    expect(out).toEqual({ action: 'duplicate', id: 99 });
    // No download, no further DB work.
    expect(matrixAdapter.downloadMedia).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('handles ER_DUP_ENTRY race: another worker inserted first', async () => {
    db.query
      .mockResolvedValueOnce([[]])                                  // dedup miss
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])  // room
      // No threadRoot, so signoff_instances is skipped.
      .mockResolvedValueOnce([[{ id: 7 }]])                         // user lookup
      // Then INSERT throws ER_DUP_ENTRY (race with concurrent worker)
      .mockImplementationOnce(() => {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        return Promise.reject(err);
      });

    matrixAdapter.downloadMedia.mockResolvedValueOnce(Buffer.from('bytes'));

    const out = await matrixMedia.processIncomingFile(makeImageEvent(), '!room:s');
    expect(out.action).toBe('duplicate');
  });
});

// ── happy path: insert + filesystem persistence ────────────────────

describe('processIncomingFile — successful intake', () => {
  test('writes file under UPLOAD_DIR/matrix-media/<project_code> and inserts row', async () => {
    db.query
      .mockResolvedValueOnce([[]])                                  // dedup miss
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])  // room
      .mockResolvedValueOnce([[{ id: 7 }]])                         // sender → user
      .mockResolvedValueOnce([{ insertId: 100 }]);                  // INSERT

    const buf = Buffer.from('imagebytes');
    matrixAdapter.downloadMedia.mockResolvedValueOnce(buf);

    const ev  = makeImageEvent({ body: 'site-photo.jpg' });
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');

    expect(out.action).toBe('inserted');
    expect(out.id).toBe(100);

    // File landed under <UPLOAD_DIR>/matrix-media/PV90/
    const projectDir = path.join(TMP_ROOT, 'matrix-media', 'PV90');
    expect(fs.existsSync(projectDir)).toBe(true);
    const written = fs.readdirSync(projectDir);
    expect(written.length).toBeGreaterThan(0);
    // Filename includes a sanitised event_id prefix and the safe filename
    expect(written[0]).toMatch(/site-photo\.jpg$/);

    // INSERT params: project_id, document_id (null), workflow_type (null),
    // filename, mimetype, size, ...
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO document_attachments/.test(c[0]));
    expect(insertCall).toBeTruthy();
    expect(insertCall[1][0]).toBe(5);                  // project_id
    expect(insertCall[1][1]).toBeNull();               // document_id (no thread)
    expect(insertCall[1][2]).toBeNull();               // workflow_type (no thread)
    expect(insertCall[1][3]).toBe('site-photo.jpg');   // filename
  });

  test('thread-root resolves document_id and workflow_type', async () => {
    db.query
      .mockResolvedValueOnce([[]])                                              // dedup miss
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])        // room
      .mockResolvedValueOnce([[{ document_id: 88, workflow_type: 'snag_rectified' }]]) // thread
      .mockResolvedValueOnce([[{ id: 7 }]])                                      // sender
      .mockResolvedValueOnce([{ insertId: 101 }]);                               // INSERT

    matrixAdapter.downloadMedia.mockResolvedValueOnce(Buffer.from('x'));

    const ev = makeImageEvent({ threadRoot: '$poll:s' });
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out.action).toBe('inserted');

    const insertCall = db.query.mock.calls.find(c => /INSERT INTO document_attachments/.test(c[0]));
    expect(insertCall[1][1]).toBe(88);                 // document_id
    expect(insertCall[1][2]).toBe('snag_rectified');   // workflow_type
  });

  test('uploaded_by_uid is null when sender is not a known user', async () => {
    db.query
      .mockResolvedValueOnce([[]])                                              // dedup
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]])                                              // user lookup empty (vendor / guest)
      .mockResolvedValueOnce([{ insertId: 102 }]);

    matrixAdapter.downloadMedia.mockResolvedValueOnce(Buffer.from('x'));

    const ev = makeImageEvent({ sender: '@guest:server' });
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out.action).toBe('inserted');

    const insertCall = db.query.mock.calls.find(c => /INSERT INTO document_attachments/.test(c[0]));
    // params order: ... uploaded_by_mxid, uploaded_by_uid, ...
    expect(insertCall[1][7]).toBe('@guest:server');
    expect(insertCall[1][8]).toBeNull();
  });
});

// ── video size cap ──────────────────────────────────────────────────

describe('processIncomingFile — video size cap', () => {
  test('rejects video > 25MB and records the rejection', async () => {
    db.query
      .mockResolvedValueOnce([[]])                                              // dedup miss
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]])                                              // user lookup
      .mockResolvedValueOnce([{ insertId: 200 }]);                              // rejection INSERT

    const ev = makeImageEvent({
      msgtype:  'm.video',
      body:     'big-video.mp4',
      mimetype: 'video/mp4',
      size:     30 * 1024 * 1024,    // 30 MB > 25 MB cap
    });

    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out.action).toBe('rejected');
    expect(out.reason).toMatch(/exceeds 25MB/);

    // No download was attempted (we bail before that).
    expect(matrixAdapter.downloadMedia).not.toHaveBeenCalled();

    // Rejection row was inserted with rejected=1 and a reason.
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO document_attachments/.test(c[0]));
    expect(insertCall).toBeTruthy();
    // The INSERT for rejection ends with: ..., rejected, rejection_reason
    const params = insertCall[1];
    expect(params[params.length - 1]).toMatch(/exceeds 25MB/);
  });

  test('accepts video under cap and downloads it', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 201 }]);

    matrixAdapter.downloadMedia.mockResolvedValueOnce(Buffer.from('vid'));

    const ev = makeImageEvent({
      msgtype:  'm.video', body: 'small.mp4',
      mimetype: 'video/mp4',
      size:     5 * 1024 * 1024,
    });
    const out = await matrixMedia.processIncomingFile(ev, '!room:s');
    expect(out.action).toBe('inserted');
    expect(matrixAdapter.downloadMedia).toHaveBeenCalledTimes(1);
  });
});

// ── image compression branch ───────────────────────────────────────

describe('processIncomingFile — image compression', () => {
  test('does NOT call sharp when image is below compression threshold', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 300 }]);

    matrixAdapter.downloadMedia.mockResolvedValueOnce(Buffer.alloc(100));   // tiny

    const out = await matrixMedia.processIncomingFile(makeImageEvent(), '!room:s');
    expect(out.action).toBe('inserted');
    expect(mockSharp).not.toHaveBeenCalled();
  });

  test('calls sharp when image is above compression threshold', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 301 }]);

    const big = Buffer.alloc(matrixMedia.IMAGE_COMPRESS_AT + 1);
    matrixAdapter.downloadMedia.mockResolvedValueOnce(big);

    // Mock sharp pipeline: sharp(buf).rotate().jpeg({...}).toBuffer()
    mockSharp.mockReturnValueOnce({
      rotate: () => ({
        jpeg:     () => ({
          toBuffer: () => Promise.resolve(Buffer.from('compressed')),
        }),
      }),
    });

    const out = await matrixMedia.processIncomingFile(makeImageEvent(), '!room:s');
    expect(out.action).toBe('inserted');
    expect(mockSharp).toHaveBeenCalledTimes(1);

    // The stored mimetype should be the compressed type (image/jpeg)
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO document_attachments/.test(c[0]));
    expect(insertCall[1][4]).toBe('image/jpeg');
  });

  test('falls back to raw bytes if sharp throws', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 302 }]);

    const big = Buffer.alloc(matrixMedia.IMAGE_COMPRESS_AT + 1);
    matrixAdapter.downloadMedia.mockResolvedValueOnce(big);

    mockSharp.mockImplementationOnce(() => { throw new Error('not a JPEG'); });

    const out = await matrixMedia.processIncomingFile(makeImageEvent({ mimetype: 'image/heic' }), '!room:s');
    expect(out.action).toBe('inserted');
    // The original mimetype is preserved when sharp fails.
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO document_attachments/.test(c[0]));
    expect(insertCall[1][4]).toBe('image/heic');
  });
});

// ── download failure ───────────────────────────────────────────────

describe('processIncomingFile — download failure', () => {
  test('returns skipped/download_failed when adapter throws', async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ project_id: 5, project_code: 'PV90' }]])
      .mockResolvedValueOnce([[]]);

    matrixAdapter.downloadMedia.mockRejectedValueOnce(new Error('network'));

    const out = await matrixMedia.processIncomingFile(makeImageEvent(), '!room:s');
    expect(out).toEqual({ action: 'skipped', reason: 'download_failed' });

    // No INSERT — file never persisted.
    const insertCalls = db.query.mock.calls.filter(c => /INSERT INTO/.test(c[0]));
    expect(insertCalls.length).toBe(0);
  });
});
